---
description: Documentação completa do Sistema de NPCs (backend)
---

# Sistema de NPCs — Documentação Técnica e de Mecânicas

Esta documentação cobre a implementação atual do sistema de NPCs no backend, incluindo:
- arquitetura,
- modelos de dados,
- mecânicas de rotina/comportamento,
- hospital e prisão,
- eventos do mundo,
- atividade autônoma,
- seed por cidade,
- cron jobs,
- endpoints REST.

---

## 1) Objetivo do sistema

O sistema de NPCs foi criado para dar vida contínua ao mundo do jogo, com entidades que:
- têm estado e localização persistentes,
- seguem rotinas horárias,
- reagem a eventos globais,
- podem ser feridas/presas/libertadas,
- guardam memória de interações com jogadores,
- geram atividade mesmo com baixo número de players online.

A implementação separa os NPCs de mundo dos NPCs de cartel (já existentes), evitando acoplamento entre sistemas.

---

## 2) Arquitetura e ficheiros

### Modelos
- `backend/models/NPC.js`
- `backend/models/NPCEvent.js`

### Serviço principal
- `backend/services/npcWorldService.js`

### Utilitários
- `backend/utils/npcHelpers.js`

### API
- Controller: `backend/controllers/npcController.js`
- Rotas: `backend/routes/npcRoutes.js`
- Montagem central: `backend/routes/index.js`

### Automação
- Cron dedicado: `backend/cronjobs/npcWorld.js`
- Bootstrap do app: `backend/app.js`

---

## 3) Modelo de dados

## 3.1) `NPC` (coleção `npcs`)

O schema foi desenhado para suportar comportamento e narrativa, não apenas status simples.

### Núcleo de identidade
- `name`
- `type`: `character | ambient | vendor | guard | criminal | medic | detective`
- `tier`: `"1" | "2" | "3"`
- `gender`, `age`, `avatar`

### Estado global
`status`:
- `alive` (bool)
- `location` (`hospital | prison | street | building | bar | home | shelter | casino | gym | school | dead`)
- `locationId` (string semântica, ex.: `cityA_zone_2`)
- `cityId`
- `condition` (`healthy | injured | recovering | arrested | dead | wanted | hiding`)
- `lastSeen`

### Atributos jogáveis
`stats`:
- `health`, `maxHealth`, `mentalHealth`
- `strength`, `agility`, `intelligence`

`personality`:
- `aggression`, `loyalty`, `greed`, `corruptibility`, `ethics`

### Fação e relações
- `faction`: `{ id, name, rank, loyalty }`
- `relationships`: `allies[]`, `enemies[]`, `neutral[]`

### Rotina
`routine`:
- `enabled`
- `suspended`
- `suspendReason`
- `schedule[]` com blocos `{ time, location, locationId, action, label }`

### Memória
`memory`:
- `playerInteractions[]`: guarda histórico por jogador com sentimento
- `npcInteractions[]`
- `knownEvents[]`

### Hospital / Prisão
`hospitalStay`:
- `admittedAt`, `expectedDischarge`, `severity`, `cause`, `treatedBy`, `sabotaged`, `visitorLog[]`

`prisonStay`:
- `arrestedAt`, `expectedRelease`, `sentence`, `crime`, `cell`, `behavior`, `escapeAttempts`, `visitorLog[]`

### Atividade / economia / meta
- `activity`: `lastAction`, `lastActionAt`, `currentEvent`, `actionLog[]`
- `economy`: `cash`, `debt`, `debtTo`
- `meta`: `seed`, `cityId`, `generatedBy`, `isPublic`, `createdAt`, `updatedAt`

### Índices
- `meta.cityId`
- `tier`
- `status.location`
- `status.condition`

---

## 3.2) `NPCEvent` (coleção `npcevents`)

Representa feed de acontecimentos públicos/privados sobre NPCs.

Campos principais:
- `type`: `npc_injured | npc_arrested | npc_released | npc_died | npc_moved | npc_action | npc_conflict`
- `npcId`, `npcName`
- `cityId`, `zoneId`
- `description`
- `publiclyVisible`
- `involvedPlayers[]`
- `metadata`
- `timestamp`

Índices:
- `(cityId, timestamp desc)`
- `(npcId, timestamp desc)`

---

## 4) Tiers e mecânicas por nível

## Tier 1 — Ambient
- Alta quantidade.
- Comportamento simples e barato (ruído de mundo).
- Pode sofrer eventos aleatórios (briga/acidente/vitimização).

## Tier 2 — Character
- Menos numerosos.
- Têm rotina ativa e ações com impacto narrativo local.
- Podem representar vendor/guard/criminal/etc.

## Tier 3 — Special
- Poucos por cidade.
- Ações especiais (investigação, expansão de facção, ações estratégicas).
- Maior visibilidade no feed.

---

## 5) Mecânica de rotina (15 em 15 min)

Função principal: `processNPCRoutines()`.

Fluxo:
1. Seleciona NPCs com rotina habilitada e não suspensa (`tier 2/3`, vivos).
2. Calcula horário atual (`HH:mm`).
3. Resolve o slot ativo com `getCurrentScheduleSlot()`.
4. Se houver mudança de local, atualiza:
   - `status.location`, `status.locationId`, `status.lastSeen`
   - `activity.lastAction`, `activity.lastActionAt`
5. Gera `NPCEvent` do tipo `npc_moved` (exceto ação de dormir).

Regra de suspensão:
- condições como `injured`, `arrested`, `dead`, `hiding` suspendem a rotina.

---

## 6) Mecânica hospitalar

### Entrada no hospital
`injureNPC(npcId, damage, cause, cityId?)`
- Diminui `stats.health`.
- Se vida <= 0: NPC morre (`condition=dead`, `location=dead`) e gera `npc_died`.
- Caso contrário:
  - `condition=injured`, `location=hospital`
  - calcula severidade: `light | moderate | critical`
  - define `expectedDischarge` (2h/6h/24h)
  - suspende rotina
  - gera evento `npc_injured`

### Ajuda de recuperação
`accelerateRecovery(...)`
- Reduz horas de alta prevista.
- Regista visita e interação positiva no histórico do NPC.

### Sabotagem
`sabotageRecovery(...)`
- Chance de ser apanhado (`caught`).
- Se bem-sucedido, aumenta tempo de alta e marca `hospitalStay.sabotaged=true`.

### Alta automática
`checkAndResumeRoutines()`
- Liberta NPCs com `expectedDischarge <= now`.
- Restaura estado saudável + rotina ativa.
- Gera `npc_released`.

---

## 7) Mecânica prisional

### Prisão
`arrestNPC(npcId, crime, sentenceHours, cityId?, arrestedBy...)`
- Move NPC para `prison`.
- Define `expectedRelease` por sentença (horas).
- Suspende rotina.
- Regista memória negativa se prisão foi por player.
- Gera `npc_arrested`.

### Fiança
`payBail(...)`
- Reduz tempo de libertação.
- Regista memória positiva de "released".

### Libertação automática
`checkAndResumeRoutines()`
- Liberta NPCs com `expectedRelease <= now`.
- Volta a `healthy` + `street` e rotina ativa.
- Gera `npc_released`.

---

## 8) Eventos do mundo

`handleWorldEvent(event)` suporta atualmente:

- `gang_war_started`
  - Ambient da zona tende a esconder-se (`shelter`, `hiding`).
  - Pode marcar membros de facção como `wanted`.

- `police_raid`
  - NPCs `criminal` da zona entram em `hiding`.

- `city_event_festival`
  - NPCs saudáveis de tier 1/2 convergem para zona de festival.

- `blackout`
  - Suspende rotinas na cidade.
  - Retoma com `releaseBlackoutSuspension(cityId)`.

---

## 9) Atividade autônoma (30 em 30 min)

`generateAutonomousActivity()`:
1. Descobre cidades com NPCs.
2. Estima atividade de jogadores por cidade.
3. Define multiplicador de atividade:
   - `<5 players`: `2.0`
   - `<20 players`: `1.5`
   - `>=20`: `1.0`
4. Executa `generateCityActivity(cityId, multiplier)`.

### Tipos de atividade
- Tier 1: `triggerAmbientEvent()`
- Tier 2: `triggerCharacterAction()`
- Tier 3: `triggerSpecialNPCAction()`

Cada ação atualiza `activity`, e normalmente gera `NPCEvent` público.

---

## 10) Seed de NPCs por cidade

`seedCityNPCs(cityId, seed)`:
- Não semeia novamente se a cidade já tiver NPCs.
- Usa RNG determinístico (`createSeededRandom`) para repetibilidade.
- Quantidades atuais:
  - 20x tier 1
  - 8x tier 2
  - 3x tier 3
- Gera rotina por tipo (`criminal`, `vendor`, `guard`, `detective`, `medic`, etc.).

---

## 11) Limpeza e reset

- `cleanOldActivityLogs(maxAgeDays=14)`
  - remove eventos antigos de `NPCEvent`
  - faz `$pull` de logs antigos de atividade e memória

- `resetDailyNPCStats()`
  - limpa `activity.currentEvent`
  - atualiza metadata

---

## 12) API REST — Endpoints

Base: `/api/npc`

## Públicos
- `GET /list`
  - filtros query: `city`, `location`, `condition`, `tier`, `type`
- `GET /:id`
- `GET /feed/:cityId?limit=50`

## Protegidos (`requireAuth`)
- `POST /:id/interact`
  - body: `{ type, notes? }`
- `GET /:id/memory/:playerId`
- `POST /:id/hospital/help`
  - body: `{ hoursReduced? }`
- `POST /:id/hospital/sabotage`
- `POST /:id/prison/pay-bail`
  - body: `{ hoursReduced? }`
- `POST /:id/injure`
  - body: `{ damage, cause?, cityId? }`
- `POST /:id/arrest`
  - body: `{ crime?, sentenceHours?, cityId? }`
- `POST /event`
  - body: `{ type, cityId, zoneId?, data? }`

---

## 13) Cron jobs do NPC World

Implementados em `backend/cronjobs/npcWorld.js`:

1. `*/15 * * * *`
   - processa rotinas
   - processa altas/libertações

2. `*/30 * * * *`
   - gera atividade autônoma por cidade

3. `0 3 * * *`
   - limpeza de logs antigos
   - reset diário de estado

O agendamento é ativado no bootstrap (`backend/app.js`) quando cron não está desativado.

---

## 14) Mecânica de memória e sentimento

Interações de jogador com NPC guardam:
- tipo de interação,
- timestamp,
- valor de sentimento,
- nota opcional.

Mapeamento base de sentimento (`getSentimentForInteraction`):
- negativo forte: `attacked`, `arrested`, `betrayed`, `robbed`
- positivo: `helped`, `released`, `saved`, `paid`
- leve: `talked`

Relação agregada (`getSentimentLabel`):
- `aliado`, `amigavel`, `neutro`, `hostil`, `inimigo`.

---

## 15) Observabilidade

Logs no cron incluem:
- volume de NPCs processados,
- quantidade de recuperados/libertados,
- total de eventos autônomos,
- resultados de cleanup/reset.

Recomendação futura:
- adicionar métricas por cidade/tier em dashboard interno.

---

## 16) Segurança e autorização

- Endpoints sensíveis usam `requireAuth`.
- Identidade do jogador vem de `req.authUserId` (JWT middleware `authUser`).
- Interações que alteram estado crítico (injure/arrest/event) já exigem autenticação.
- Para produção, recomenda-se elevar alguns endpoints para perfil admin/moderação.

---

## 17) Extensão recomendada (próximos passos)

1. **Permissões finas**
   - separar endpoints de gameplay vs moderação (RBAC por role).

2. **Mapeamento real de atividade por cidade**
   - hoje a contagem de players usa heurística; ideal ligar a sistema de presença por região.

3. **Economia NPC avançada**
   - integrar `economy.cash/debt` com mercado, lojas e facções.

4. **Conflitos multi-NPC**
   - eventos de combate grupal com impacto em relações e território.

5. **Ferramentas admin para seed/reset por cidade**
   - endpoint para semear cidade sob demanda.

---

## 18) Checklist de validação funcional

- [ ] Criar seed de uma cidade e verificar 31 NPCs
- [ ] Confirmar movimentos automáticos de tier 2/3 a cada 15 min
- [ ] Ferir NPC e validar hospital + alta automática
- [ ] Prender NPC e validar prisão + libertação automática
- [ ] Testar help/sabotage/pay-bail e verificar memória/eventos
- [ ] Disparar `POST /api/npc/event` para cada tipo suportado
- [ ] Confirmar feed com `GET /api/npc/feed/:cityId`
- [ ] Validar limpeza diária de logs

---

## 19) Referência rápida de implementação

- Schema NPC: `backend/models/NPC.js`
- Schema eventos: `backend/models/NPCEvent.js`
- Helpers: `backend/utils/npcHelpers.js`
- Serviço principal: `backend/services/npcWorldService.js`
- Cron: `backend/cronjobs/npcWorld.js`
- Controller: `backend/controllers/npcController.js`
- Rotas: `backend/routes/npcRoutes.js`
- Mount de rotas: `backend/routes/index.js`
- Bootstrap cron: `backend/app.js`
