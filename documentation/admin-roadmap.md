---
description: Roadmap para expansão do Admin Console
---

# Roadmap – Admin Console 2.0

## Objetivos Macro
- **Liberar controles críticos**: permitir que moderadores ajustem estados de hospital/jail/vida sem acessar o banco.
- **Acelerar moderação**: pacotes de punição, notas internas e indicadores de prioridade reduzem atrito.
- **Dar visibilidade operacional**: logs rápidos e painel de buffs ajudam suporte a diagnosticar em segundos.
- **Preparar base para eventos**: ferramentas globais extras e presets reutilizáveis encurtam ciclos de eventos.

## Fases
1. **Fase 1 – Fundamentos de Jogador**
   - Player State (hospital/jail) + Vida/Vitais.
   - Painel de notas internas.
2. **Fase 2 – Poderes Operacionais**
   - Pacotes de punição, suporte flag, presets de itens.
   - Painel de buffs/boosts, logs rápidos.
3. **Fase 3 – Mundo & Eventos**
   - Controles globais extras (chain/events) e gestão de regeneração.
   - API para presets públicos e automações.

## Itens Detalhados

### 1. Painel Hospital / Jail — ✅ Entregue (2026-03-08)
- **Porquê**: desbloquear, punir ou corrigir estados bugados em segundos.
- **UI**: novo bloco no tab "Jogador" mostrando status atual, selects para `hospitalized`/`jailed`, inputs de segundos e botões "Aplicar"/"Libertar".
- **Backend**: `PATCH /admin/player/state` que valida limites e persiste `hospitalized`, `hospitalTime`, `jailed`, `jailTime`.

### 2. Editor de Vida / Vital Signs — ✅ Entregue (2026-03-08)
- **Porquê**: reviver jogadores ou setar 1 HP sem criar itens.
- **UI**: cartão no tab "Stats" com valor atual de `health`, botões "Full Heal" e "1 HP" e input numérico.
- **Backend**: `PATCH /admin/player/health` reutilizando lógica de heal (ex.: clamp 0‑9999 e ajuste de hospitalization quando full heal).

### 3. Controle de Regeneração
- **Porquê**: congelar regen durante eventos ou penalizar jogadores.
- **UI**: switches por recurso + campo "tempo adicional" em "Logs & Cooldowns".
- **Backend**: novos campos (`regenPauseUntil.energy`, etc.) ou documento auxiliar + rota `/admin/player/regen` para pausar/retomar.

### 4. Histórico rápido do jogador
- **Porquê**: contexto antes de banir/suspreender (últimos crimes, login, batalhas).
- **UI**: timeline compacta com filtros (24h/7d) no tab "Logs & Cooldowns".
- **Backend**: `/admin/player/activity/:userId` agregando coleções de logs existentes; fallback para eventos críticos.

### 5. Pacotes de punição (Presets disciplinares)
- **Porquê**: garantir consistência (ex.: ban + reset cooldown + jail 24h).
- **UI**: dropdown "Aplicar pacote" dentro de Moderação com pré-visualização.
- **Backend**: endpoint `/admin/player/punishment` recebendo slug do pacote e executando múltiplas ações atômicas.

### 6. Gestão de Buffs/Boosts Ativos
- **Porquê**: remover efeitos bugados sem mexer no DB.
- **UI**: lista de boosts ativos (nome, duração restante) com botão "Remover".
- **Backend**: rota `/admin/player/boosts` para listar/remover entradas em `activeBoosts` (ou equivalente).

### 7. Ferramentas globais extras
- **Porquê**: resetar chains/eventos, ajustar moedas sazonais em massa.
- **UI**: novos botões em "Mundo" (Reset chain, Ativar evento, set seasonal coins).
- **Backend**: rotas `/admin/general/reset-chain`, `/admin/events/:event/toggle`, `/admin/general/seasonal-coins` com filtros (role, nível, NPC).

### 8. Biblioteca de presets de itens
- **Porquê**: reaproveitar configurações complexas de itens.
- **UI**: painel na seção "Criar item" com lista de presets salvos, botões "Aplicar" e "Salvar preset atual".
- **Backend**: coleção `ItemPreset`, rotas `/admin/items/presets` (listar/criar/apagar) e vínculo de autor.

### 9. Notas internas do jogador — ✅ Entregue (2026-03-08)
- **Porquê**: registrar histórico de suporte/moderação dentro da plataforma.
- **UI**: bloco "Notas" com textarea, timeline de entradas (autor, data) e tags.
- **Backend**: coleção `PlayerAdminNote` + rotas CRUD (`/admin/player/notes`).

### 10. Prioridade de suporte (Support Flag)
- **Porquê**: sinalizar casos críticos para a equipe e UI principal.
- **UI**: toggle no perfil + campo de expiração (ex.: 24h). Mostrar badge nos painéis.
- **Backend**: campos `supportFlagUntil`, `supportFlagReason` no player + rota `/admin/player/support-flag`.

---
**Sequência Recomendada**
1. Refatorar UI em abas + adicionar blocos vazios (estrutura).
2. Implementar Fase 1 (state + health + notas) com rotas correspondentes.
3. Incrementar Fase 2 (pacotes, buffs, presets) com testes de autorização.
4. Fechar Fase 3 com controles globais e regen management.

> Cada entrega deve incluir endpoints, validações e feedback visual (toasts + estados carregando) para manter consistência do console.
