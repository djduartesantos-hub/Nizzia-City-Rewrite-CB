<template>
  <section class="admin-container">
    <header class="admin-header">
      <div>
        <p class="eyebrow">Painel Operacional</p>
        <h2>Admin Console</h2>
        <p class="subtitle">Ferramentas rápidas para suporte, economia e mundo.</p>
      </div>
      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab"
          class="tab-btn"
          :class="{ active: currentTab === tab }"
          @click="currentTab = tab"
        >
          {{ tab }}
        </button>
      </div>
    </header>

    <section class="section-block">
      <div class="section-heading">
        <div>
          <p class="eyebrow mini">Seleção rápida</p>
          <h3>Jogador alvo & Pesquisa</h3>
          <p class="muted">Carrega pela ID numérica ou pesquisa por nome/UID antes de aplicar ações.</p>
        </div>
        <div v-if="profile" class="section-meta">
          <span class="badge">{{ profile.playerRole }}</span>
          <span class="muted">{{ profile.playerStatus }}</span>
        </div>
      </div>
      <div class="card-grid two-col">
        <div class="card focus-card">
          <div class="card-header">
            <h3>Target ativo</h3>
            <small v-if="profile">{{ profile.name }}</small>
          </div>
          <div class="row">
            <div>
              <label>Player ID</label>
              <input v-model.trim="targetPlayerId" placeholder="ex: 748" />
            </div>
            <div>
              <label>UserId (auto)</label>
              <input v-model="targetUserId" readonly />
            </div>
          </div>
          <div class="actions">
            <button @click="onLoadPlayer">Carregar jogador</button>
            <button class="secondary" @click="onSaveIds">Guardar IDs</button>
            <span class="muted" v-if="profile">Status: {{ profile.playerStatus }} · Role: {{ profile.playerRole }}</span>
          </div>
        </div>

        <div class="card focus-card">
          <div class="card-header">
            <h3>Pesquisar Jogador</h3>
            <small>Nome, ID numérico ou ObjectId</small>
          </div>
          <div class="inline">
            <input v-model.trim="searchQuery" @keyup.enter="onSearch" @input="onSearchDebounced" placeholder="ex: Oscar, 123, 64f09..." />
            <button @click="onSearch">Pesquisar</button>
          </div>
          <div class="list">
            <div v-if="searchResults.length === 0" class="muted">Sem resultados</div>
            <div v-for="p in searchResults" :key="p.userId" class="list-row">
              <div>
                <strong>{{ p.name }}</strong>
                <span class="muted">#{{ p.id }} · {{ p.role || 'Player' }}</span>
              </div>
              <button class="secondary" @click="useSearchPlayer(p)">Selecionar</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="tab-panel" v-show="currentTab === 'Jogador'">
      <section class="section-block">
        <div class="section-heading">
          <div>
            <p class="eyebrow mini">Visão geral</p>
            <h3>Perfil & Identidade</h3>
            <p class="muted">Resumo financeiro, vitais e identidade do jogador selecionado.</p>
          </div>
        </div>
        <div class="card-grid">
          <div class="card" v-if="profile">
            <h3>Perfil do Jogador</h3>
            <div class="list player-glance">
              <div class="player-id">
                <strong>{{ profile.name }}</strong>
                <span class="muted">id={{ profile.id }}</span>
                <span v-if="profile.npc" class="pill">NPC</span>
              </div>
              <div class="stat-grid">
                <div class="stat">
                  <span class="label">Status</span>
                  <span class="value">{{ profile.playerStatus }}</span>
                </div>
                <div class="stat">
                  <span class="label">Role</span>
                  <span class="value">{{ profile.playerRole }}</span>
                </div>
                <div class="stat">
                  <span class="label">Title</span>
                  <span class="value">{{ profile.playerTitle }}</span>
                </div>
              </div>
              <div class="stat-grid wide">
                <div class="stat"><span class="label">Money</span><span class="value">${{ num(profile.finances?.money || 0) }}</span></div>
                <div class="stat"><span class="label">Bank</span><span class="value">${{ num(profile.finances?.bankLocked || 0) }}</span></div>
                <div class="stat"><span class="label">Portfolio</span><span class="value">${{ num(profile.finances?.portfolioValue || 0) }}</span></div>
                <div class="stat"><span class="label">Net worth</span><span class="value">${{ num(profile.finances?.netWorth || 0) }}</span></div>
              </div>
              <div class="vital-grid">
                <div class="vital"><span>Energy</span><strong>{{ profile.vitals?.energy || 0 }}/{{ profile.vitals?.energyMax || 0 }}</strong></div>
                <div class="vital"><span>Nerve</span><strong>{{ profile.vitals?.nerve || 0 }}/{{ profile.vitals?.nerveMax || 0 }}</strong></div>
                <div class="vital"><span>Happy</span><strong>{{ profile.vitals?.happy || 0 }}/{{ profile.vitals?.happyMax || 0 }}</strong></div>
              </div>
            </div>
          </div>

          <div class="card" v-if="profile">
            <h3>Identidade</h3>
            <div class="row">
              <div>
                <label>Novo nome</label>
                <input v-model.trim="newName" placeholder="3-32 chars" />
              </div>
            </div>
            <div class="actions">
              <button @click="applyName">Aplicar nome</button>
              <span class="muted">Não altera o Player.id.</span>
            </div>
          </div>

          <div class="card" v-if="profile">
            <h3>Support Flag</h3>
            <p class="muted">Destaca o jogador em dashboards e relatórios.</p>
            <div class="row">
              <div>
                <label>Active</label>
                <div class="toggle">
                  <input type="checkbox" v-model="supportFlagForm.enabled" />
                  <span>{{ supportFlagForm.enabled ? 'Flagged' : 'Off' }}</span>
                </div>
              </div>
              <div>
                <label>Duration (h)</label>
                <input v-model.number="supportFlagForm.durationHours" type="number" min="1" />
              </div>
              <div>
                <label>Reason</label>
                <input v-model.trim="supportFlagForm.reason" maxlength="200" placeholder="ex: Investigação chargeback" />
              </div>
            </div>
            <div class="actions">
              <button @click="saveSupportFlag">Guardar</button>
              <span class="muted">{{ profile.supportFlagUntil ? `Ativo até ${fmt(profile.supportFlagUntil)}` : 'Sem flag' }}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="section-block">
        <div class="section-heading">
          <div>
            <p class="eyebrow mini">Moderação</p>
            <h3>Status, roles e punições</h3>
            <p class="muted">Aplica ações disciplinares e presets de punição com notas automáticas.</p>
          </div>
        </div>
        <div class="card-grid two-col">
          <div class="card">
            <h3>Moderação</h3>
            <div class="row">
              <div>
                <label>Status</label>
                <select v-model="modStatus">
                  <option value="Active">Active</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Banned">Banned</option>
                  <option value="Abandoned">Abandoned</option>
                </select>
              </div>
              <div>
                <label>Role</label>
                <select v-model="modRole">
                  <option value="Player">Player</option>
                  <option value="Moderator">Moderator</option>
                  <option value="Admin">Admin</option>
                  <option value="Developer">Developer</option>
                </select>
              </div>
              <div>
                <label>Title</label>
                <select v-model="modTitle">
                  <option v-for="t in titles" :key="t" :value="t">{{ t }}</option>
                </select>
              </div>
            </div>
            <div class="actions">
              <button @click="applyStatus">Set Status</button>
              <button @click="applyRole">Set Role</button>
              <button @click="applyTitle">Set Title</button>
            </div>
          </div>

          <div class="card">
            <h3>Punições</h3>
            <p class="muted">Bundles de status/jail/cooldowns + nota automática.</p>
            <div class="row">
              <div>
                <label>Preset</label>
                <select v-model="selectedPunishmentPreset">
                  <option value="">— select —</option>
                  <option v-for="preset in punishmentPresets" :key="preset.value" :value="preset.value">{{ preset.label }}</option>
                </select>
              </div>
            </div>
            <div class="actions">
              <button :disabled="!selectedPunishmentPreset" @click="applyPunishment">Aplicar Preset</button>
            </div>
          </div>
        </div>
      </section>

      <section class="section-block">
        <div class="section-heading">
          <div>
            <p class="eyebrow mini">Contexto</p>
            <h3>Notas administrativas</h3>
            <p class="muted">Documenta intervenções e historial recente.</p>
          </div>
        </div>
        <div class="card card-full">
          <div class="card-header">
            <h3>Notas e Histórico</h3>
            <small>Mostra últimas notas internas do jogador</small>
          </div>
          <div class="note-form">
            <textarea v-model.trim="noteText" rows="3" placeholder="Adicionar nota administrativa"></textarea>
            <div class="actions">
              <button @click="createNote" :disabled="!noteText">Guardar Nota</button>
              <select v-model="noteFilter">
                <option value="all">Todas</option>
                <option value="system">Sistema</option>
                <option value="manual">Manuais</option>
              </select>
            </div>
          </div>
          <div class="notes-list">
            <div v-if="notes.length === 0" class="muted">Nenhuma nota ainda.</div>
            <div v-for="note in filteredNotes" :key="note._id" class="note-row">
              <header>
                <div>
                  <strong>{{ note.author }}</strong>
                  <span class="muted">{{ fmt(note.createdAt) }}</span>
                </div>
                <span class="chip" :class="note.type">{{ note.type }}</span>
              </header>
              <p>{{ note.text }}</p>
            </div>
          </div>
        </div>
        <div v-if="!profile" class="empty-state">Seleciona um jogador para editar stats.</div>
      </section>
    </div>

    <div class="tab-panel" v-show="currentTab === 'Economia'">
      <section class="section-block">
        <div class="section-heading">
          <div>
            <p class="eyebrow mini">Recursos</p>
            <h3>Economia & Recursos</h3>
            <p class="muted">Ajusta vitais instantaneamente ou injeta moedas específicas.</p>
          </div>
        </div>
        <div class="card-grid two-col">
          <div class="card">
            <h3>Resources</h3>
            <div class="row">
              <div><label>Energy Δ</label><input v-model.number="resources.energyDelta" type="number" /></div>
              <div><label>Nerve Δ</label><input v-model.number="resources.nerveDelta" type="number" /></div>
              <div><label>Happy Δ</label><input v-model.number="resources.happyDelta" type="number" /></div>
            </div>
            <div class="actions">
              <button @click="applyResources">Aplicar</button>
              <button class="secondary" @click="energyToMax">Energy = Max</button>
              <button class="secondary" @click="nerveToMax">Nerve = Max</button>
              <button class="secondary" @click="happyToMax">Happy = Max</button>
            </div>
          </div>

          <div class="card">
            <h3>Moedas & Currencies</h3>
            <div class="row">
              <div><label>Money Δ</label><input v-model.number="currency.moneyDelta" type="number" /></div>
              <div><label>Points Δ</label><input v-model.number="currency.pointsDelta" type="number" /></div>
              <div><label>Merits Δ</label><input v-model.number="currency.meritsDelta" type="number" /></div>
            </div>
            <div class="row">
              <div><label>Xmas Coins Δ</label><input v-model.number="currency.xmasCoinsDelta" type="number" /></div>
              <div><label>Halloween Coins Δ</label><input v-model.number="currency.halloweenCoinsDelta" type="number" /></div>
              <div><label>Easter Coins Δ</label><input v-model.number="currency.easterCoinsDelta" type="number" /></div>
            </div>
            <div class="actions">
              <button @click="applyCurrency">Aplicar Δ</button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div class="tab-panel" v-show="currentTab === 'Stats'">
      <section class="section-block">
        <div class="section-heading">
          <div>
            <p class="eyebrow mini">Progressão</p>
            <h3>Atributos de batalha & trabalho</h3>
            <p class="muted">Ajusta manualmente os stats para debugging ou compensações.</p>
          </div>
        </div>
        <div class="card-grid two-col">
          <div class="card" v-if="profile">
            <h3>Battle Stats</h3>
            <div class="row">
              <div><label>Strength</label><input v-model.number="battle.strength" type="number" min="0" /></div>
              <div><label>Speed</label><input v-model.number="battle.speed" type="number" min="0" /></div>
              <div><label>Dexterity</label><input v-model.number="battle.dexterity" type="number" min="0" /></div>
              <div><label>Defense</label><input v-model.number="battle.defense" type="number" min="0" /></div>
            </div>
            <div class="actions">
              <button @click="applyBattleStats">Atualizar</button>
              <span class="muted">Total atual: {{ num((profile?.battleStats?.strength||0) + (profile?.battleStats?.speed||0) + (profile?.battleStats?.dexterity||0) + (profile?.battleStats?.defense||0)) }}</span>
            </div>
          </div>

          <div class="card" v-if="profile">
            <h3>Work Stats</h3>
            <div class="row">
              <div><label>Manual Labor</label><input v-model.number="work.manuallabor" type="number" min="0" /></div>
              <div><label>Intelligence</label><input v-model.number="work.intelligence" type="number" min="0" /></div>
              <div><label>Endurance</label><input v-model.number="work.endurance" type="number" min="0" /></div>
              <div><label>Employee Efficiency</label><input v-model.number="work.employeEfficiency" type="number" min="0" /></div>
            </div>
            <div class="actions">
              <button @click="applyWorkStats">Atualizar</button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div class="tab-panel" v-show="currentTab === 'Inventário & Itens'">
      <section class="section-block">
        <div class="section-heading">
          <div>
            <p class="eyebrow mini">Itens</p>
            <h3>Inventário & editor</h3>
            <p class="muted">Adiciona/remover itens rapidamente ou cria presets completos.</p>
          </div>
        </div>
        <div class="card-grid">
          <div class="card card-full">
            <div class="card-header">
              <div>
                <h3>Equipamentos atuais</h3>
                <small>Mostra slots ocupados pelo jogador selecionado.</small>
              </div>
              <div class="inventory-meta" v-if="profile">
                <span>Itens únicos: {{ inventoryStatsComputed.unique }}</span>
                <span>Total (qty): {{ inventoryStatsComputed.totalQty }}</span>
              </div>
            </div>
            <div class="loadout-grid" v-if="profile">
              <div class="slot" v-for="slot in equippedSlots" :key="slot.key">
                <div class="slot-icon" :class="{ filled: !!slot.item }">{{ slot.icon }}</div>
                <div class="slot-details">
                  <p class="slot-label">{{ slot.label }}</p>
                  <p v-if="slot.item" class="slot-name">{{ slot.item.name }}</p>
                  <p v-else class="muted">Vazio</p>
                  <small v-if="slot.item">{{ itemStatsSummary(slot.item) }}</small>
                </div>
              </div>
            </div>
            <div v-else class="empty-state">Carrega um jogador para ver slots equipados.</div>
          </div>

          <div class="card card-full">
            <div class="card-header">
              <div>
                <h3>Inventário do Jogador</h3>
                <small>Lista completa com filtros e ações rápidas.</small>
              </div>
              <div class="inventory-actions">
                <div class="inline">
                  <div class="category-chips">
                    <button
                      v-for="cat in inventoryCategories"
                      :key="cat.key"
                      class="chip"
                      :class="{ active: inventoryFilters.category === cat.key }"
                      @click="inventoryFilters.category = cat.key"
                    >
                      {{ cat.icon }} {{ cat.label }}
                    </button>
                  </div>
                </div>
                <input
                  v-model.trim="inventoryFilters.search"
                  placeholder="Buscar item..."
                  class="inventory-search"
                />
              </div>
            </div>
            <div class="inventory-toolbar">
              <div class="inline">
                <div><label>Item ID</label><input v-model.trim="invItemId" placeholder="Item.id ou Mongo _id" /></div>
                <div><label>Qtd</label><input v-model.number="invQty" type="number" min="1" /></div>
                <button @click="invAdd">Adicionar</button>
                <button class="secondary" @click="invRemove">Remover</button>
              </div>
              <span class="muted" v-if="invStatus">{{ invStatus }}</span>
            </div>
            <div class="inventory-table" v-if="profile">
              <div v-if="filteredInventory.length === 0" class="muted">Nenhum item encontrado.</div>
              <div v-else>
                <div class="inventory-row header">
                  <span>Item</span>
                  <span>Tipo</span>
                  <span>Stats</span>
                  <span>Qtd</span>
                  <span>Ações</span>
                </div>
                <div class="inventory-row" v-for="item in filteredInventory" :key="item.dbId">
                  <div class="item-name">
                    <span class="icon">{{ iconForType(item.type) }}</span>
                    <div>
                      <strong>{{ item.name }}</strong>
                      <div class="muted">ID: {{ resolveInventoryIdentifier(item) }}</div>
                    </div>
                  </div>
                  <div>{{ item.type }}</div>
                  <div>{{ itemStatsSummary(item) || '—' }}</div>
                  <div>{{ item.qty }}</div>
                  <div class="row-actions">
                    <button class="ghost" @click="() => adjustInventory(item, 1)">+1</button>
                    <button class="ghost" @click="() => adjustInventory(item, -1)">-1</button>
                    <button class="ghost" @click="() => copyToClipboard(resolveInventoryIdentifier(item))">Copiar ID</button>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="empty-state">Carrega um jogador para visualizar o inventário.</div>
          </div>

          <div class="card card-full">
            <h3>Criação de Itens</h3>
            <div class="inline">
              <div>
                <label>Presets salvos</label>
                <select v-model="selectedItemPresetId">
                  <option value="">— nenhum —</option>
                  <option v-for="preset in itemPresets" :key="preset._id" :value="preset._id">{{ preset.name }} — {{ preset.authorName || 'Admin' }}</option>
                </select>
              </div>
              <button class="secondary" :disabled="!selectedItemPresetId" @click="applyItemPreset">Carregar preset</button>
              <button class="secondary" :disabled="!selectedItemPresetId" @click="deleteItemPresetClient">Apagar preset</button>
            </div>
            <div class="inline">
              <div>
                <label>Novo preset</label>
                <input v-model.trim="newPresetName" placeholder="ex: Booster meta" />
              </div>
              <button :disabled="!newPresetName" @click="saveItemPreset">Guardar preset</button>
              <button class="secondary" :disabled="presetsLoading" @click="loadItemPresets">Recarregar lista</button>
            </div>
            <div class="row">
              <div><label>Name</label><input v-model.trim="item.name" /></div>
              <div><label>Type</label>
                <select v-model="item.type">
                  <option value="weapon">weapon</option>
                  <option value="alcohol">alcohol</option>
                  <option value="booster">booster</option>
                  <option value="cache">cache</option>
                  <option value="armor">armor</option>
                  <option value="medicine">medicine</option>
                  <option value="clothes">clothes</option>
                  <option value="tools">tools</option>
                  <option value="drugs">drugs</option>
                  <option value="collectibles">collectibles</option>
                </select>
              </div>
              <div><label>Item id</label><input v-model="item.id" placeholder="string or number" /></div>
              <div><label>Price</label><input v-model.number="item.price" type="number" min="0" /></div>
              <div><label>Sellable</label>
                <select v-model="item.sellable"><option :value="true">true</option><option :value="false">false</option></select>
              </div>
              <div><label>Usable</label>
                <select v-model="item.usable"><option :value="true">true</option><option :value="false">false</option></select>
              </div>
              <div style="grid-column: 1 / -1"><label>Description</label><input v-model.trim="item.description" /></div>
            </div>
            <!-- restante do editor igual ao bloco completo anterior -->
            <div class="row" v-if="['weapon','armor','clothes'].includes(item.type)">
              <div>
                <label>Subtype</label>
                <select v-model="item.type2">
                  <option value="">— select —</option>
                  <option value="primaryWeapon">Primary Weapon</option>
                  <option value="secondaryWeapon">Secondary Weapon</option>
                  <option value="meleeWeapon">Melee Weapon</option>
                  <option value="head">Head</option>
                  <option value="torso">Torso</option>
                  <option value="pants">Pants</option>
                  <option value="shoes">Shoes</option>
                  <option value="legs">Legs</option>
                </select>
              </div>
            </div>

            <div class="row" v-if="item.type==='weapon'">
              <div><label>Damage</label><input v-model.number="item.damage" type="number" min="0" /></div>
              <div><label>Quality</label><input v-model.number="item.quality" type="number" min="0" max="100" /></div>
            </div>

            <div class="row" v-if="item.type==='armor'">
              <div><label>Armor</label><input v-model.number="item.armor" type="number" min="0" /></div>
              <div><label>Coverage (%)</label><input v-model.number="item.coverage" type="number" min="0" max="100" /></div>
              <div><label>Quality</label><input v-model.number="item.quality" type="number" min="0" max="100" /></div>
            </div>

            <div v-if="['medicine','alcohol','enhancers','drugs','booster','cache'].includes(item.type)" class="list">
              <label>Effects</label>
              <div class="row">
                <div>
                  <label><input type="checkbox" v-model="ebEnable.energy" /> Energy Δ</label>
                  <input v-model.number="ebEnergy" type="number" placeholder="e.g. 250" />
                </div>
                <div>
                  <label><input type="checkbox" v-model="ebEnable.nerve" /> Nerve Δ</label>
                  <input v-model.number="ebNerve" type="number" placeholder="e.g. 5" />
                </div>
                <div>
                  <label><input type="checkbox" v-model="ebEnable.happy" /> Happiness Δ</label>
                  <input v-model.number="ebHappy" type="number" placeholder="e.g. 1000" />
                </div>
                <div>
                  <label><input type="checkbox" v-model="ebEnable.points" /> Points Δ</label>
                  <input v-model.number="ebPoints" type="number" placeholder="e.g. 5" />
                </div>
              </div>
              <div class="row">
                <div>
                  <label><input type="checkbox" v-model="ebEnable.b_str" /> Bonus Strength</label>
                  <input v-model.number="ebBonus.strength" type="number" placeholder="e.g. 100" />
                </div>
                <div>
                  <label><input type="checkbox" v-model="ebEnable.b_dex" /> Bonus Dexterity</label>
                  <input v-model.number="ebBonus.dexterity" type="number" placeholder="e.g. 100" />
                </div>
                <div>
                  <label><input type="checkbox" v-model="ebEnable.b_spd" /> Bonus Speed</label>
                  <input v-model.number="ebBonus.speed" type="number" placeholder="e.g. 100" />
                </div>
                <div>
                  <label><input type="checkbox" v-model="ebEnable.b_def" /> Bonus Defense</label>
                  <input v-model.number="ebBonus.defense" type="number" placeholder="e.g. 100" />
                </div>
              </div>

              <label>Cooldowns</label>
              <div class="row">
                <div>
                  <label><input type="checkbox" v-model="ebEnable.cdAlcohol" /> Alcohol (sec)</label>
                  <input v-model.number="ebCooldowns.alcohol" type="number" placeholder="e.g. 3600" />
                </div>
                <div>
                  <label><input type="checkbox" v-model="ebEnable.cdBooster" /> Booster (sec)</label>
                  <input v-model.number="ebCooldowns.booster" type="number" placeholder="e.g. 1800" />
                </div>
                <div>
                  <label><input type="checkbox" v-model="ebEnable.cdDrug" /> Drug (sec)</label>
                  <input v-model.number="ebCooldowns.drug" type="number" placeholder="e.g. 43200" />
                </div>
                <div>
                  <label><input type="checkbox" v-model="ebEnable.cdMedical" /> Medical (sec)</label>
                  <input v-model.number="ebCooldowns.medical" type="number" placeholder="e.g. 7200" />
                </div>
              </div>

              <div v-if="item.type==='cache'" class="list">
                <label>Cache contents</label>
                <div class="row">
                  <div><label>Money Min</label><input v-model.number="cacheMoneyMin" type="number" min="0" /></div>
                  <div><label>Money Max</label><input v-model.number="cacheMoneyMax" type="number" min="0" /></div>
                  <div><label>Money Chance (%)</label><input v-model.number="cacheMoneyChancePct" type="number" min="0" max="100" /></div>
                </div>
                <div class="row">
                  <div><label>Points Min</label><input v-model.number="cachePointsMin" type="number" min="0" /></div>
                  <div><label>Points Max</label><input v-model.number="cachePointsMax" type="number" min="0" /></div>
                  <div><label>Points Chance (%)</label><input v-model.number="cachePointsChancePct" type="number" min="0" max="100" /></div>
                </div>
                <div class="list">
                  <div class="list-row" v-for="(row, idx) in cacheItems" :key="idx">
                    <div class="inline">
                      <div><label>Item id</label><input v-model.trim="row.id" placeholder="custom Item.id" /></div>
                      <div><label>Qty Min</label><input v-model.number="row.qtyMin" type="number" min="1" /></div>
                      <div><label>Qty Max</label><input v-model.number="row.qtyMax" type="number" min="1" /></div>
                      <div><label>Chance (%)</label><input v-model.number="row.chancePct" type="number" min="0" max="100" /></div>
                    </div>
                    <button class="secondary" @click="removeCacheItem(idx)">Remove</button>
                  </div>
                  <button class="secondary" @click="addCacheItem">+ Add cache item</button>
                </div>
              </div>
            </div>

            <div class="actions">
              <button class="secondary" @click="presetXanax">Preset: Xanax</button>
              <button class="secondary" @click="presetEnergy250">Preset: Energy +250</button>
              <button class="secondary" @click="presetBoosterSmall">Preset: Booster Small</button>
              <button class="secondary" @click="applyEffectBuilder">Apply to JSON</button>
            </div>
            <div class="row">
              <div style="grid-column: 1 / -1">
                <label>Effect (JSON)</label>
                <textarea v-model.trim="effectJson" rows="3" @change="loadEffectFromJson"></textarea>
              </div>
            </div>

            <div v-if="['alcohol','drugs'].includes(item.type)" class="row">
              <div style="grid-column: 1 / -1"><label>Overdose Effect (JSON)</label><textarea v-model.trim="overdoseJson" rows="3"></textarea></div>
            </div>

            <div v-if="['tools','collectibles'].includes(item.type)" class="row">
              <div style="grid-column: 1 / -1"><label>Passive Effect (JSON)</label><textarea v-model.trim="passiveJson" rows="3"></textarea></div>
            </div>

            <div class="actions">
              <button @click="createItem">Create Item</button>
              <button class="secondary" @click="downloadAllItems">Download all (JSON)</button>
              <button class="secondary" @click="fetchItems">Refresh list</button>
            </div>

            <div class="list muted">{{ createItemStatus }}</div>

            <div class="list">
              <h4>All Items</h4>
              <div v-if="items.length===0" class="muted">No items yet</div>
              <div v-for="i in items" :key="i._id" class="list-row">
                <div>
                  <div><strong>{{ i.name }}</strong> — {{ i.type }} (id={{ i.id }})</div>
                  <div class="muted" v-if="i.type2">Subtype: {{ i.type2 }}</div>
                </div>
                <button class="secondary" @click="deleteItem(i._id)">Delete</button>
              </div>
            </div>
          </div>
        </div>
        <div v-if="!profile" class="empty-state">Carrega um jogador para gerir inventário e itens.</div>
      </section>
    </div>
    <div class="tab-panel" v-show="currentTab === 'Mundo'">
      <section class="section-block">
        <div class="section-heading">
          <div>
            <p class="eyebrow mini">Mercado urbano</p>
            <h3>Finanças e banca</h3>
            <p class="muted">Controla ações, contas de poupança e fluxos de juros.</p>
          </div>
        </div>
        <div class="card-grid two-col">
          <div class="card">
            <h3>Estoque & Bolsa</h3>
            <div class="inline">
              <div><label>Symbol</label><input v-model.trim="stockSymbol" placeholder="e.g. FLY" /></div>
              <div><label>Shares</label><input v-model.number="stockShares" type="number" min="1" /></div>
              <div><label>Avg Price (opcional)</label><input v-model.number="stockAvgPrice" type="number" step="0.0001" /></div>
              <button @click="stockAdd">Add</button>
              <button class="secondary" @click="stockRemove">Remove</button>
              <button class="secondary" title="Crash (-40% a -90%)" @click="stockCrash">Crash</button>
              <button title="Rocket (+40% a +130%)" @click="stockRocket">Rocket</button>
            </div>
          </div>

          <div class="card card-full">
            <h3>Accounts Bancárias</h3>
            <div class="actions"><button @click="loadAccounts">Load Accounts</button></div>
            <div class="list">
              <div v-for="ac in bankAccounts" :key="ac._id" class="list-row">
                <div>{{ ac._id }} | principal ${{ ac.depositedAmount }} | APR {{ ac.interestRate }}% | {{ ac.period }} | start {{ fmt(ac.startDate) }} | end {{ fmt(ac.endDate) }} | withdrawn {{ ac.isWithdrawn }}</div>
                <button :disabled="ac.isWithdrawn" @click="forceWithdraw(ac._id)">Force Withdraw</button>
              </div>
              <div v-if="bankAccounts.length===0" class="muted">Sem contas.</div>
            </div>
          </div>
        </div>
      </section>

      <section class="section-block">
        <div class="section-heading">
          <div>
            <p class="eyebrow mini">Operações globais</p>
            <h3>Cooldowns, cartel e bulks</h3>
            <p class="muted">Ferramentas de manutenção para resets e distribuições massivas.</p>
          </div>
        </div>
        <div class="card-grid two-col">
          <div class="card">
            <h3>Cooldowns</h3>
            <div class="actions"><button @click="cdLoad">Carregar Atual</button></div>
            <div class="list">{{ cdCurrentSummary }}</div>
            <div class="row">
              <div><label>Drug (s)</label><input v-model.number="cdDrug" type="number" min="0" /></div>
              <div><label>Medical (s)</label><input v-model.number="cdMedical" type="number" min="0" /></div>
              <div><label>Booster (s)</label><input v-model.number="cdBooster" type="number" min="0" /></div>
              <div><label>Alcohol (s)</label><input v-model.number="cdAlcohol" type="number" min="0" /></div>
            </div>
            <div class="actions">
              <button @click="cdSet('drug')">Set Drug</button>
              <button @click="cdSet('medical')">Set Medical</button>
              <button @click="cdSet('booster')">Set Booster</button>
              <button @click="cdSet('alcohol')">Set Alcohol</button>
              <button class="secondary" @click="cdClear('all')">Clear Player</button>
            </div>
            <div class="inline">
              <div>
                <label>Include NPCs</label>
                <select v-model="cdIncludeNPC"><option value="false">false</option><option value="true">true</option></select>
              </div>
              <button class="secondary" title="Reset global" @click="cdResetAll">Reset All</button>
            </div>
          </div>

          <div class="card">
            <h3>Cartel Reputation</h3>
            <div class="inline">
              <div>
                <label>Rep Level</label>
                <select v-model.number="cartelRepLevel">
                  <option :value="-1">— pick rank —</option>
                  <option v-for="r in cartelRanks" :key="r.level" :value="r.level">{{ r.level }} — {{ r.name }} ({{ r.xpRequired.toLocaleString() }} rep)</option>
                </select>
              </div>
              <div><label>Reputação exata</label><input v-model.number="cartelRepExact" type="number" min="0" placeholder="valor exato" /></div>
              <button @click="applyCartelRep">Aplicar</button>
            </div>
            <div v-if="cartelRepMsg" class="muted">{{ cartelRepMsg }}</div>
          </div>
        </div>
        <div class="card-grid two-col">
          <div class="card">
            <h3>Bulks & Riscos</h3>
            <div class="inline">
              <div>
                <label>Include NPCs</label>
                <select v-model="generalIncludeNPC"><option value="false">false</option><option value="true">true</option></select>
              </div>
              <button class="secondary" @click="generalEnergyMax">Energy = max (global)</button>
            </div>
            <div class="inline">
              <div><label>Money Δ (bulk)</label><input v-model.number="generalMoneyAmount" type="number" /></div>
              <button class="secondary" @click="generalGiveMoney">Give money a todos</button>
            </div>
            <div class="divider"></div>
            <div class="inline">
              <div><label>Addiction</label><input v-model.number="addictionValue" type="number" min="0" /></div>
              <button @click="setAddiction">Set Addiction</button>
            </div>
            <div class="muted">Drop DB (dev only)</div>
            <div class="inline">
              <div><label>Type DROP</label><input v-model.trim="dbConfirm" placeholder="DROP" /></div>
              <button class="secondary" @click="dbPurge">DROP DB</button>
            </div>
          </div>
        </div>
      </section>

      <section class="section-block">
        <div class="section-heading">
          <div>
            <p class="eyebrow mini">Estado do mundo</p>
            <h3>Prisão, Hospital e Crimes</h3>
            <p class="muted">Ajuda a calibrar punições e métricas globais.</p>
          </div>
        </div>
        <div class="card-grid">
          <div class="card card-full world-config-card">
            <div class="card-header">
              <h3>Gestão de Prisão & Hospital</h3>
              <small>Parâmetros globais e ações rápidas</small>
              <div class="actions">
                <button class="secondary" @click="hydrateWorldTab(true)">Recarregar</button>
              </div>
            </div>
            <div v-if="worldLoading" class="muted">Carregando…</div>
            <div v-else class="world-sections">
              <section>
                <header>
                  <h4>Prisão</h4>
                  <div class="muted">Define fianças, tempos padrão e regras de fuga</div>
                </header>
                <div class="metrics">
                  <div class="stat">
                    <label>Presos ativos</label>
                    <strong>{{ prisonOverview.stats.total }}</strong>
                  </div>
                  <div class="stat">
                    <label>Tempo médio</label>
                    <strong>{{ humanDuration(prisonOverview.stats.avgSeconds) }}</strong>
                  </div>
                  <div class="stat">
                    <label>Última fuga</label>
                    <strong>{{ prisonOverview.stats.lastBreakout ? fmt(prisonOverview.stats.lastBreakout) : '—' }}</strong>
                  </div>
                  <button class="ghost" @click="refreshPrisonOverview(true)" :disabled="prisonOverview.loading">Atualizar</button>
                </div>
                <div class="snapshot-list" v-if="prisonOverview.list.length">
                  <p class="muted">Top detidos recentes</p>
                  <ul>
                    <li v-for="inmate in prisonOverview.list" :key="inmate.userId">
                      <div>
                        <strong>{{ inmate.name }}</strong>
                        <span class="muted"> · {{ inmate.crime || '—' }}</span>
                      </div>
                      <span class="timer">{{ shortCountdown(inmate.remainingSeconds) }}</span>
                    </li>
                  </ul>
                </div>
                <div v-else class="empty-state">Sem presos listados no momento.</div>
                <div class="snapshot-list" v-if="prisonOverview.events.length">
                  <p class="muted">Eventos recentes</p>
                  <ul>
                    <li v-for="evt in prisonOverview.events" :key="evt.id || evt.ts">
                      <span>{{ evt.summary }}</span>
                      <small class="muted">{{ fmt(evt.ts) }}</small>
                    </li>
                  </ul>
                </div>
                <div v-else class="empty-state">Nenhum evento de prisão recente.</div>
                <div class="row">
                  <div><label>Min (s)</label><input v-model.number="worldConfigs.prison.minJailSeconds" type="number" min="60" /></div>
                  <div><label>Default (s)</label><input v-model.number="worldConfigs.prison.defaultJailSeconds" type="number" min="60" /></div>
                  <div><label>Cap (s)</label><input v-model.number="worldConfigs.prison.jailCapSeconds" type="number" min="60" /></div>
                </div>
                <div class="row">
                  <div><label>Bail base</label><input v-model.number="worldConfigs.prison.bailBase" type="number" min="0" /></div>
                  <div><label>Por bloco</label><input v-model.number="worldConfigs.prison.bailPerBlock" type="number" min="0" /></div>
                  <div><label>Tam bloco (s)</label><input v-model.number="worldConfigs.prison.bailBlockSeconds" type="number" min="60" /></div>
                  <div><label>Mult.</label><input v-model.number="worldConfigs.prison.bailMultiplier" type="number" min="0.1" step="0.1" /></div>
                </div>
                <div class="row">
                  <div><label>Penalty fuga (s)</label><input v-model.number="worldConfigs.prison.breakoutPenaltySeconds" type="number" min="0" /></div>
                  <div><label>Penalty cap (s)</label><input v-model.number="worldConfigs.prison.breakoutPenaltyCapSeconds" type="number" min="0" /></div>
                  <div><label>Chance base fuga</label><input v-model.number="worldConfigs.prison.breakoutBaseChance" type="number" step="0.01" min="0" max="1" /></div>
                  <div><label>Bónus lvl fuga</label><input v-model.number="worldConfigs.prison.breakoutLevelBonus" type="number" step="0.001" min="0" max="1" /></div>
                </div>
                <div class="row">
                  <label class="toggle">
                    <input type="checkbox" v-model="worldConfigs.prison.breakoutAssistEnabled" />
                    <span>Permitir assistências de fuga</span>
                  </label>
                </div>
                <div class="actions">
                  <button @click="forceJail()">Prender target</button>
                  <button class="secondary" @click="releaseTarget('prison')">Libertar target</button>
                  <button :disabled="worldSaving.prison" @click="savePrisonConfig">Guardar Prisão</button>
                </div>
              </section>

              <section>
                <header>
                  <h4>Hospital</h4>
                  <div class="muted">Custos de revive, tratamentos e limites</div>
                </header>
                <div class="metrics">
                  <div class="stat">
                    <label>Internados</label>
                    <strong>{{ hospitalOverview.stats.total }}</strong>
                  </div>
                  <div class="stat">
                    <label>Tempo médio</label>
                    <strong>{{ humanDuration(hospitalOverview.stats.avgSeconds) }}</strong>
                  </div>
                  <div class="stat">
                    <label>Último revive</label>
                    <strong>{{ hospitalOverview.stats.lastRevive ? fmt(hospitalOverview.stats.lastRevive) : '—' }}</strong>
                  </div>
                  <button class="ghost" @click="refreshHospitalOverview(true)" :disabled="hospitalOverview.loading">Atualizar</button>
                </div>
                <div class="snapshot-list" v-if="hospitalOverview.list.length">
                  <p class="muted">Pacientes críticos</p>
                  <ul>
                    <li v-for="patient in hospitalOverview.list" :key="patient.userId">
                      <div>
                        <strong>{{ patient.name }}</strong>
                        <span class="muted"> · HP {{ patient.health }}</span>
                      </div>
                      <span class="timer">{{ shortCountdown(patient.remainingSeconds) }}</span>
                    </li>
                  </ul>
                </div>
                <div v-else class="empty-state">Sem pacientes ativos.</div>
                <div class="snapshot-list" v-if="hospitalOverview.events.length">
                  <p class="muted">Eventos clínicos</p>
                  <ul>
                    <li v-for="evt in hospitalOverview.events" :key="evt.id || evt.ts">
                      <span>{{ evt.summary }}</span>
                      <small class="muted">{{ fmt(evt.ts) }}</small>
                    </li>
                  </ul>
                </div>
                <div v-else class="empty-state">Nenhum evento de hospital recente.</div>
                <div class="row">
                  <div><label>Min (s)</label><input v-model.number="worldConfigs.hospital.minHospitalSeconds" type="number" min="60" /></div>
                  <div><label>Default (s)</label><input v-model.number="worldConfigs.hospital.defaultHospitalSeconds" type="number" min="60" /></div>
                  <div><label>Cap (s)</label><input v-model.number="worldConfigs.hospital.hospitalCapSeconds" type="number" min="60" /></div>
                </div>
                <div class="row">
                  <div><label>Tratamento (s)</label><input v-model.number="worldConfigs.hospital.treatSeconds" type="number" min="30" /></div>
                  <div><label>HP/s tratamento</label><input v-model.number="worldConfigs.hospital.treatHealthPerSecond" type="number" step="0.1" min="0" /></div>
                  <div><label>Revive base</label><input v-model.number="worldConfigs.hospital.reviveBase" type="number" min="0" /></div>
                  <div><label>Revive por bloco</label><input v-model.number="worldConfigs.hospital.revivePerBlock" type="number" min="0" /></div>
                </div>
                <div class="row">
                  <div><label>Tam bloco (s)</label><input v-model.number="worldConfigs.hospital.reviveBlockSeconds" type="number" min="60" /></div>
                  <div><label>Factor lvl</label><input v-model.number="worldConfigs.hospital.reviveLevelFactor" type="number" min="0" /></div>
                  <div><label>HP mínimo revive</label><input v-model.number="worldConfigs.hospital.reviveHealthFloor" type="number" min="1" /></div>
                </div>
                <div class="row">
                  <label class="toggle">
                    <input type="checkbox" v-model="worldConfigs.hospital.allowPaidRevive" />
                    <span>Permitir revives pagos</span>
                  </label>
                </div>
                <div class="actions">
                  <button @click="forceHospital()">Hospitalizar target</button>
                  <button class="secondary" @click="releaseTarget('hospital')">Dar alta</button>
                  <button :disabled="worldSaving.hospital" @click="saveHospitalConfig">Guardar Hospital</button>
                </div>
              </section>
            </div>
          </div>

          <div class="card card-full world-config-card">
            <div class="card-header">
              <h3>Punições de Crimes</h3>
              <small>Controla dano, hospitalizações e prisão automática</small>
            </div>
            <div v-if="worldLoading" class="muted">Carregando…</div>
            <div v-else class="world-sections single">
              <section>
                <div class="row">
                  <label class="toggle">
                    <input type="checkbox" v-model="worldConfigs.crime.enableHealthLoss" />
                    <span>Perder vida em critic fail</span>
                  </label>
                  <label class="toggle">
                    <input type="checkbox" v-model="worldConfigs.crime.enableHospitalize" />
                    <span>Enviar para hospital</span>
                  </label>
                  <label class="toggle">
                    <input type="checkbox" v-model="worldConfigs.crime.enableJail" />
                    <span>Possível prisão</span>
                  </label>
                  <label class="toggle">
                    <input type="checkbox" v-model="worldConfigs.crime.logEvents" />
                    <span>Logar eventos</span>
                  </label>
                </div>
                <div class="row">
                  <div><label>Dano %</label><input v-model.number="worldConfigs.crime.criticalHpLossPercent" type="number" min="0" max="100" /></div>
                  <div><label>Dano fixo</label><input v-model.number="worldConfigs.crime.criticalHpLossFlat" type="number" min="0" /></div>
                  <div><label>HP mínimo antes hospital</label><input v-model.number="worldConfigs.crime.hospitalizeBelowHealth" type="number" min="0" /></div>
                </div>
                <div class="row">
                  <div><label>Hospital base (s)</label><input v-model.number="worldConfigs.crime.hospitalSeconds" type="number" min="0" /></div>
                  <div><label>Hospital var (s)</label><input v-model.number="worldConfigs.crime.hospitalVarianceSeconds" type="number" min="0" /></div>
                  <div><label>HP mínimo ao internar</label><input v-model.number="worldConfigs.crime.hospitalHealthFloor" type="number" min="0" /></div>
                </div>
                <div class="row">
                  <div><label>Prisão chance (%)</label><input v-model.number="worldConfigs.crime.jailChancePercent" type="number" min="0" max="100" /></div>
                  <div><label>Prisão base (s)</label><input v-model.number="worldConfigs.crime.jailSeconds" type="number" min="0" /></div>
                  <div><label>Prisão var (s)</label><input v-model.number="worldConfigs.crime.jailVarianceSeconds" type="number" min="0" /></div>
                  <div><label>Prisão cap (s)</label><input v-model.number="worldConfigs.crime.jailMaxSeconds" type="number" min="0" /></div>
                </div>
                <div class="row">
                  <div><label>Severidade (minor)</label><input v-model.number="worldConfigs.crime.severityMultipliers.minor" type="number" step="0.1" min="0" /></div>
                  <div><label>Severidade (moderate)</label><input v-model.number="worldConfigs.crime.severityMultipliers.moderate" type="number" step="0.1" min="0" /></div>
                  <div><label>Severidade (major)</label><input v-model.number="worldConfigs.crime.severityMultipliers.major" type="number" step="0.1" min="0" /></div>
                </div>
                <div class="actions">
                  <button :disabled="worldSaving.crime" @click="saveCrimeConfig">Guardar Crimes</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>

      <section class="section-block">
        <div class="section-heading">
          <div>
            <p class="eyebrow mini">Design de Missões</p>
            <h3>Catálogo de Crimes jogáveis</h3>
            <p class="muted">Edita dificuldade, custos, recompensas, loot e blurb de eventos exibidos na página Crimes.</p>
          </div>
          <div class="actions">
            <button class="secondary" @click="hydrateWorldTab(true)">Recarregar</button>
            <button @click="saveCrimeCatalog" :disabled="catalogSaving">Guardar Catálogo</button>
          </div>
        </div>
        <div class="card-grid two-col">
          <div class="card">
            <div class="card-header">
              <h3>Lista de crimes</h3>
              <small>Seleciona para editar detalhes</small>
            </div>
            <div class="inline">
              <button @click="addCrime">+ Adicionar crime</button>
              <button class="secondary" @click="saveCrimeCatalog" :disabled="catalogSaving">Guardar</button>
            </div>
            <div class="list">
              <div
                v-for="crime in crimeCatalog"
                :key="crime.id"
                class="list-row crime-row"
                :class="{ active: crime.id === selectedCrimeId }"
                @click="selectCrime(crime.id)">
                <div>
                  <strong>{{ crime.title }}</strong>
                  <div class="muted">{{ crime.tag || 'Sem tag' }} · {{ crime.difficulty }}</div>
                </div>
                <div class="inline">
                  <button class="ghost" title="Duplicar" @click.stop="duplicateCrime(crime.id)">Duplicar</button>
                  <button class="ghost" title="Remover" @click.stop="deleteCrime(crime.id)">Remover</button>
                </div>
              </div>
              <div v-if="crimeCatalog.length === 0" class="muted">Nenhum crime configurado.</div>
            </div>
          </div>

          <div class="card card-full" v-if="selectedCrime">
            <div class="card-header">
              <h3>Detalhes do crime</h3>
              <small>Alterações são guardadas localmente até clicar em "Guardar Catálogo".</small>
            </div>
            <div class="row">
              <div><label>ID</label><input v-model.trim="selectedCrime.id" /></div>
              <div><label>Nome</label><input v-model.trim="selectedCrime.title" /></div>
              <div><label>Tag</label><input v-model.trim="selectedCrime.tag" /></div>
            </div>
            <div class="row">
              <div>
                <label>Dificuldade</label>
                <select v-model="selectedCrime.difficulty">
                  <option>Baixa</option>
                  <option>Média</option>
                  <option>Alta</option>
                  <option>Muito alta</option>
                </select>
              </div>
              <div>
                <label>Status</label>
                <select v-model="selectedCrime.status">
                  <option value="available">Disponível</option>
                  <option value="soon">Em preparação</option>
                  <option value="locked">Bloqueado</option>
                </select>
              </div>
              <div><label>CTA</label><input v-model.trim="selectedCrime.cta" /></div>
              <div><label>Icone</label><input v-model.trim="selectedCrime.icon" maxlength="2" /></div>
            </div>
            <div class="row">
              <div><label>Nerve</label><input v-model.number="selectedCrime.nerveCost" type="number" min="0" /></div>
              <div><label>Cooldown (s)</label><input v-model.number="selectedCrime.cooldownSeconds" type="number" min="0" /></div>
              <div><label>Custo cash</label><input v-model.number="selectedCrime.cashCost" type="number" min="0" /></div>
            </div>
            <div class="row">
              <div><label>Payout mínimo</label><input v-model.number="selectedCrime.payoutMin" type="number" min="0" /></div>
              <div><label>Payout máximo</label><input v-model.number="selectedCrime.payoutMax" type="number" min="selectedCrime.payoutMin || 0" /></div>
            </div>
            <div>
              <label>Descrição</label>
              <textarea v-model.trim="selectedCrime.description" rows="2"></textarea>
            </div>

            <div>
              <label>Notas de loot</label>
              <textarea v-model.trim="selectedCrime.lootNotes" rows="2"></textarea>
            </div>

            <div class="card-subsection">
              <div class="inline">
                <h4>Loot</h4>
                <button class="secondary" @click="addLootEntry">Adicionar loot</button>
              </div>
              <div class="list" v-if="selectedCrime.loot.length">
                <div class="list-row" v-for="(loot, idx) in selectedCrime.loot" :key="`loot-${idx}`">
                  <div class="row">
                    <div>
                      <label>Nome</label>
                      <input v-model.trim="loot.label" />
                    </div>
                    <div>
                      <label>Tipo</label>
                      <select v-model="loot.type">
                        <option value="money">Money</option>
                        <option value="item">Item</option>
                      </select>
                    </div>
                    <div>
                      <label>Chance (%)</label>
                      <input v-model.number="loot.chance" type="number" min="0" max="100" />
                    </div>
                  </div>
                  <div class="row">
                    <div v-if="loot.type === 'money'">
                      <label>Mínimo</label>
                      <input v-model.number="loot.min" type="number" min="0" />
                    </div>
                    <div v-if="loot.type === 'money'">
                      <label>Máximo</label>
                      <input v-model.number="loot.max" type="number" :min="loot.min || 0" />
                    </div>
                    <div v-else>
                      <label>Item ID</label>
                      <input v-model.trim="loot.itemId" placeholder="mongo id ou slug" />
                    </div>
                    <div class="inline">
                      <button class="secondary" @click="removeLootEntry(idx)">Remover</button>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="muted">Sem loot definido.</div>
            </div>

            <div class="card-subsection">
              <h4>Eventos & narrativa</h4>
              <div class="row">
                <div>
                  <label>Success</label>
                  <textarea :value="eventText('success')" @input="updateCrimeEvent('success', $event.target.value)" rows="3" placeholder="Uma frase por linha"></textarea>
                </div>
                <div>
                  <label>Fail</label>
                  <textarea :value="eventText('fail')" @input="updateCrimeEvent('fail', $event.target.value)" rows="3"></textarea>
                </div>
                <div>
                  <label>Critical fail</label>
                  <textarea :value="eventText('critical')" @input="updateCrimeEvent('critical', $event.target.value)" rows="3"></textarea>
                </div>
              </div>
            </div>

            <div class="actions">
              <button class="secondary" @click="saveCrimeCatalog" :disabled="catalogSaving">Guardar alterações</button>
            </div>
          </div>

          <div class="card empty-state" v-else>
            Seleciona um crime para editar.
          </div>
        </div>
      </section>
    </div>

    <div class="tab-panel" v-show="currentTab === 'Logs & Cooldowns'">
      <section class="section-block">
        <div class="section-heading">
          <div>
            <p class="eyebrow mini">Boosts</p>
            <h3>Boosts & efeitos ativos</h3>
            <p class="muted">Investiga buffs bugados ou adiciona efeitos temporários.</p>
          </div>
        </div>
        <div class="card card-full">
          <div class="card-header">
            <h3>Boosts & Effects</h3>
            <small>Investigue buffs bugados ou adicione efeitos temporários</small>
          </div>
          <div class="actions">
            <button @click="fetchBoosts" :disabled="boostsLoading">Refresh</button>
          </div>
          <div class="list">
            <div v-if="boostsLoading" class="muted">Carregando boosts…</div>
            <div v-else-if="!boosts.length" class="muted">Nenhum boost ativo</div>
            <div v-else class="boost-list">
              <div class="boost-card" v-for="boost in boosts" :key="boost._id">
                <div>
                  <div class="boost-title">{{ boost.label }}</div>
                  <div class="muted">{{ boost.source || 'desconhecida' }} · {{ fmt(boost.appliedAt) }}</div>
                  <div class="muted" v-if="boost.expiresAt">Expira {{ fmt(boost.expiresAt) }} · {{ boost.remainingSeconds }}s</div>
                  <pre v-if="Object.keys(boost.meta||{}).length" class="meta">{{ JSON.stringify(boost.meta, null, 2) }}</pre>
                </div>
                <button class="secondary" @click="removeBoost(boost._id)">Remover</button>
              </div>
            </div>
          </div>
          <div class="add-boost">
            <h4>Adicionar Boost manual</h4>
            <div class="row">
              <div><label>Nome</label><input v-model.trim="boostForm.label" placeholder="ex: Evento Carnaval" /></div>
              <div><label>Duração (s)</label><input v-model.number="boostForm.durationSeconds" type="number" min="0" /></div>
              <div><label>Fonte</label><input v-model.trim="boostForm.source" placeholder="admin:Nome" /></div>
            </div>
            <div>
              <label>Meta (JSON)</label>
              <textarea v-model.trim="boostForm.metaJson" rows="2" placeholder='{"bonus":"+20% exp"}'></textarea>
            </div>
            <div class="actions">
              <button @click="addBoost" :disabled="boostsLoading || !boostForm.label">Adicionar</button>
            </div>
          </div>
        </div>
      </section>

      <section class="section-block">
        <div class="section-heading">
          <div>
            <p class="eyebrow mini">Auditoria</p>
            <h3>Logs do Jogador</h3>
            <p class="muted">Snapshots horários, transações recentes e respingos financeiros.</p>
          </div>
        </div>
        <div class="card card-full">
          <div class="inline">
            <div><label>Tx limite</label><input v-model.number="logsFilters.txLimit" type="number" min="5" max="100" /></div>
            <div><label>Snapshots limite</label><input v-model.number="logsFilters.snapshotLimit" type="number" min="10" max="200" /></div>
            <button @click="fetchLogs" :disabled="logsLoading">Atualizar</button>
            <span class="muted" v-if="logsLastFetched">Atualizado {{ fmt(logsLastFetched) }}</span>
          </div>
          <div class="log-columns">
            <div class="list">
              <h4>Snapshots ({{ logs.snapshots.length }})</h4>
              <div v-if="logsLoading" class="muted">Carregando…</div>
              <div v-else-if="!logs.snapshots.length" class="muted">Sem snapshots recentes</div>
              <div v-else class="snapshot-list">
                <div class="snapshot-card" v-for="snap in logs.snapshots" :key="snap._id || snap.ts">
                  <div class="snapshot-ts">{{ fmt(snap.ts) }}</div>
                  <div class="muted">Net worth ${{ num(snap.netWorth || 0) }} · Money ${{ num(snap.money || 0) }} · Bank ${{ num(snap.bankLocked || 0) }} · Port ${{ num(snap.portfolioValue || 0) }}</div>
                  <div class="muted">Battle {{ num(snap.battleTotals?.total || 0) }} · Work {{ num(snap.workTotal || 0) }}</div>
                  <div class="muted">Vitals {{ snap.vitals?.energy }}/{{ snap.vitals?.energyMax }} · Cooldowns D{{ snap.cooldowns?.drug || 0 }} M{{ snap.cooldowns?.medical || 0 }} B{{ snap.cooldowns?.booster || 0 }} A{{ snap.cooldowns?.alcohol || 0 }}</div>
                </div>
              </div>
            </div>
            <div class="list">
              <h4>Transações recentes ({{ logs.transactions.length }})</h4>
              <div v-if="logsLoading" class="muted">Carregando…</div>
              <div v-else-if="!logs.transactions.length" class="muted">Sem transações no intervalo</div>
              <div v-else class="tx-list">
                <div class="tx-row" v-for="tx in logs.transactions" :key="tx._id">
                  <div>
                    <strong>{{ tx.type }}</strong>
                    <div class="muted">{{ fmt(tx.createdAt) }}</div>
                  </div>
                  <div class="value">${{ num(tx.amount || 0) }}</div>
                  <div class="muted">Saldo {{ num(tx.balanceAfter || 0) }}</div>
                  <div class="desc">{{ tx.description }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, onMounted, watch, computed } from 'vue'
import api from '../api/client'
import { useToast } from '../composables/useToast'
import { fmtInt as num, fmtDate as fmt } from '../utils/format'

const toast = useToast()

const targetPlayerId = ref('')
const targetUserId = ref('')
const profile = ref(null)
const profileLoading = ref(false)
const profileError = ref('')
const newName = ref('')
const tabs = ['Jogador', 'Economia', 'Stats', 'Inventário & Itens', 'Mundo', 'Logs & Cooldowns']
const currentTab = ref('Jogador')
const isLogsTab = computed(() => currentTab.value === 'Logs & Cooldowns')

const slotDefinitions = [
  { key: 'primaryWeapon', label: 'Primária', icon: '🔫' },
  { key: 'secondaryWeapon', label: 'Secundária', icon: '🔁' },
  { key: 'meleeWeapon', label: 'Corpo a corpo', icon: '🗡️' },
  { key: 'head', label: 'Cabeça', icon: '🪖' },
  { key: 'torso', label: 'Torso', icon: '🧥' },
  { key: 'pants', label: 'Pernas', icon: '👖' },
  { key: 'shoes', label: 'Calçado', icon: '🥾' },
  { key: 'legs', label: 'Acessório', icon: '🧤' },
]

const inventoryCategories = [
  { key: 'all', label: 'Todos', icon: 'Layers' },
  { key: 'weapon', label: 'Armas', icon: '🔫' },
  { key: 'armor', label: 'Armadura', icon: '🛡️' },
  { key: 'medicine', label: 'Medkits', icon: '💉' },
  { key: 'drugs', label: 'Drogas', icon: '💊' },
  { key: 'booster', label: 'Boosters', icon: '⚡' },
  { key: 'tools', label: 'Ferramentas', icon: '🧰' },
  { key: 'collectibles', label: 'Coleções', icon: '🃏' },
]

const inventoryFilters = reactive({ category: 'all', search: '' })

const searchQuery = ref('')
const searchResults = ref([])

const modStatus = ref('Active')
const modRole = ref('Player')
const modTitle = ref('')
const titles = ref([])
const punishmentPresets = [
  { value: 'warn_watch', label: 'Warning + Watchlist' },
  { value: 'temp_suspend', label: 'Suspensão 72h' },
  { value: 'cheat_ban', label: 'Cheat Ban (permanent)' },
]
const selectedPunishmentPreset = ref('')
const supportFlagForm = ref({ enabled: false, durationHours: 24, reason: '' })

const notes = ref([])
const noteText = ref('')
const noteFilter = ref('all')
const filteredNotes = computed(() => {
  if (noteFilter.value === 'all') return notes.value
  return notes.value.filter((note) => note.type === noteFilter.value)
})

const currency = ref({ moneyDelta: 0, pointsDelta: 0, meritsDelta: 0, xmasCoinsDelta: 0, halloweenCoinsDelta: 0, easterCoinsDelta: 0 })
const expDelta = ref(0)
const levelSet = ref(1)
const resources = ref({ energyDelta: 0, nerveDelta: 0, happyDelta: 0 })
const battle = ref({ strength: 0, speed: 0, dexterity: 0, defense: 0 })
const work = ref({ manuallabor: 0, intelligence: 0, endurance: 0, employeEfficiency: 0 })

const generalIncludeNPC = ref('false')
const generalMoneyAmount = ref(0)

const invItemId = ref('')
const invQty = ref(1)
const invStatus = ref('')

const equippedSlots = computed(() =>
  slotDefinitions.map((slot) => ({
    ...slot,
    item: profile.value?.equipment?.[slot.key] || null,
  }))
)

const inventoryItems = computed(() => profile.value?.inventory || [])
const inventoryStatsComputed = computed(() => profile.value?.inventoryStats || { unique: 0, totalQty: 0 })

const filteredInventory = computed(() => {
  let list = inventoryItems.value
  const category = (inventoryFilters.category || 'all').toLowerCase()
  if (category !== 'all') {
    list = list.filter((item) => (item.type || '').toLowerCase() === category)
  }
  const term = inventoryFilters.search.trim().toLowerCase()
  if (term) {
    list = list.filter((item) => {
      const haystack = `${item.name || ''} ${item.itemId || ''} ${item.type || ''}`.toLowerCase()
      return haystack.includes(term)
    })
  }
  return list
})

const typeIconMap = {
  weapon: '🔫',
  armor: '🛡️',
  clothes: '🧥',
  medicine: '💉',
  drugs: '💊',
  booster: '⚡',
  tools: '🧰',
  collectibles: '🃏',
  cache: '📦',
  materials: '🧱',
}

function iconForType(type) {
  return typeIconMap[type] || '🎒'
}

function itemStatsSummary(item) {
  const parts = []
  const dmg = item?.stats?.damage
  const armor = item?.stats?.armor
  const quality = item?.stats?.quality
  if (dmg) parts.push(`DMG ${dmg}`)
  if (armor) parts.push(`ARM ${armor}`)
  if (quality) parts.push(`Q${quality}`)
  return parts.join(' · ')
}

function resolveInventoryIdentifier(item) {
  return item?.itemId || item?.dbId || ''
}

const item = ref({ name: '', type: 'tools', id: 0, price: 0, sellable: true, usable: true, description: '' })
const createItemStatus = ref('')
const items = ref([])
const itemPresets = ref([])
const selectedItemPresetId = ref('')
const newPresetName = ref('')
const presetsLoading = ref(false)

// Effect builder state
const ebEnable = ref({ energy: true, nerve: false, happy: false, points: false, b_str: false, b_dex: false, b_spd: false, b_def: false, cdAlcohol: false, cdBooster: false, cdDrug: false, cdMedical: false })
const ebEnergy = ref(0)
const ebNerve = ref(0)
const ebHappy = ref(0)
const ebPoints = ref(0)
const ebBonus = ref({ strength: 0, dexterity: 0, speed: 0, defense: 0 })
const ebCooldowns = ref({ alcohol: 0, booster: 0, drug: 0, medical: 0 })
const effectJson = ref('')
const overdoseJson = ref('')
const passiveJson = ref('')
const cacheMoneyMin = ref(0)
const cacheMoneyMax = ref(0)
const cacheMoneyChancePct = ref(100)
const cachePointsMin = ref(0)
const cachePointsMax = ref(0)
const cachePointsChancePct = ref(0)
const cacheItems = ref([])

const stockSymbol = ref('')
const stockShares = ref(1)
const stockAvgPrice = ref(null)

const bankAccounts = ref([])
const bankAccountId = ref('')

const cdDrug = ref(0)
const cdMedical = ref(0)
const cdBooster = ref(0)
const cdAlcohol = ref(0)
const cdIncludeNPC = ref('false')
const cdCurrentSummary = ref('')

// Boosts & logs
const boosts = ref([])
const boostsLoading = ref(false)
const boostForm = ref({ label: '', durationSeconds: 0, source: '', metaJson: '' })
const logs = ref({ snapshots: [], transactions: [] })
const logsLoading = ref(false)
const logsFilters = ref({ txLimit: 20, snapshotLimit: 40 })
const logsLastFetched = ref(null)

const dbConfirm = ref('')
const addictionValue = ref(0)
const cartelRepLevel = ref(-1)
const cartelRepExact = ref(null)
const cartelRepMsg = ref('')
const cartelRanks = [
  { level: 0, name: 'Nobody',             xpRequired: 0 },
  { level: 1, name: 'Corner Boy',         xpRequired: 100 },
  { level: 2, name: 'Street Hustler',     xpRequired: 500 },
  { level: 3, name: 'Shot Caller',        xpRequired: 1500 },
  { level: 4, name: 'Underboss',          xpRequired: 5000 },
  { level: 5, name: 'Drug Lord',          xpRequired: 15000 },
  { level: 6, name: 'Kingpin',            xpRequired: 40000 },
  { level: 7, name: 'Narco God',          xpRequired: 100000 },
  { level: 8, name: 'El Padrino',         xpRequired: 200000 },
  { level: 9, name: 'The One Who Knocks', xpRequired: 500000 },
]

const worldBase = {
  prison: {
    jailCapSeconds: 86400,
    minJailSeconds: 300,
    defaultJailSeconds: 3600,
    bailBase: 25000,
    bailPerBlock: 5000,
    bailBlockSeconds: 300,
    bailMultiplier: 1,
    breakoutPenaltySeconds: 180,
    breakoutPenaltyCapSeconds: 1800,
    breakoutBaseChance: 0.35,
    breakoutLevelBonus: 0.01,
    breakoutAssistEnabled: true,
  },
  hospital: {
    hospitalCapSeconds: 86400,
    minHospitalSeconds: 120,
    defaultHospitalSeconds: 900,
    treatSeconds: 180,
    treatHealthPerSecond: 0.4,
    reviveBase: 20000,
    revivePerBlock: 4000,
    reviveBlockSeconds: 300,
    reviveLevelFactor: 500,
    reviveHealthFloor: 150,
    allowPaidRevive: true,
  },
  crime: {
    enableHealthLoss: true,
    criticalHpLossPercent: 25,
    criticalHpLossFlat: 0,
    enableHospitalize: true,
    hospitalSeconds: 900,
    hospitalVarianceSeconds: 120,
    hospitalHealthFloor: 35,
    hospitalizeBelowHealth: 20,
    enableJail: true,
    jailChancePercent: 35,
    jailSeconds: 1200,
    jailVarianceSeconds: 180,
    jailMaxSeconds: 6400,
    logEvents: true,
    severityMultipliers: { minor: 0.6, moderate: 1, major: 1.4 },
  },
  crimeCatalog: {
    crimes: [],
  },
}

function cloneWorldBase() {
  return JSON.parse(JSON.stringify(worldBase))
}

const worldConfigs = reactive(cloneWorldBase())
const worldLoading = ref(false)
const worldLoaded = ref(false)
const worldSaving = reactive({ prison: false, hospital: false, crime: false })
const crimeCatalog = ref([])
const selectedCrimeId = ref('')
const catalogSaving = ref(false)

const prisonOverview = reactive({
  loading: false,
  stats: { total: 0, avgSeconds: 0, lastBreakout: null },
  list: [],
  events: [],
  lastFetched: null,
})

const hospitalOverview = reactive({
  loading: false,
  stats: { total: 0, avgSeconds: 0, lastRevive: null },
  list: [],
  events: [],
  lastFetched: null,
})

function mergeWorldSection(section, incoming = {}) {
  if (section === 'crime') {
    const severity = incoming.severityMultipliers || {}
    const rest = { ...incoming }
    delete rest.severityMultipliers
    Object.assign(worldConfigs.crime, rest)
    worldConfigs.crime.severityMultipliers = {
      ...worldConfigs.crime.severityMultipliers,
      ...severity,
    }
    return
  }
  Object.assign(worldConfigs[section], incoming || {})
}

async function loadWorldConfigs(force = false) {
  if (worldLoading.value) return
  if (worldLoaded.value && !force) return
  try {
    worldLoading.value = true
    const res = await api.get('/admin/world/config')
    const configs = res.data?.configs || {}
    mergeWorldSection('prison', configs.prison)
    mergeWorldSection('hospital', configs.hospital)
    mergeWorldSection('crime', configs.crime)
    crimeCatalog.value = (configs.crimeCatalog?.crimes || []).map((entry) => cloneCrimeEntry(entry))
    if (!crimeCatalog.value.length) {
      crimeCatalog.value.push(cloneCrimeEntry())
    }
    if (!crimeCatalog.value.some((crime) => crime.id === selectedCrimeId.value)) {
      selectedCrimeId.value = crimeCatalog.value[0]?.id || ''
    }
    worldLoaded.value = true
  } catch (e) {
    toast.error(e?.response?.data?.error || 'Falha ao carregar configs globais')
  } finally {
    worldLoading.value = false
  }
}

async function saveWorldSection(section, endpoint, trackerKey) {
  try {
    worldSaving[trackerKey] = true
    await api.post(endpoint, worldConfigs[section])
    toast.success('Configurações guardadas')
  } catch (e) {
    toast.error(e?.response?.data?.error || 'Falha ao guardar configuração')
  } finally {
    worldSaving[trackerKey] = false
  }
}

const savePrisonConfig = () => saveWorldSection('prison', '/admin/world/config/prison', 'prison')
const saveHospitalConfig = () => saveWorldSection('hospital', '/admin/world/config/hospital', 'hospital')
const saveCrimeConfig = () => saveWorldSection('crime', '/admin/world/config/crime', 'crime')

function humanDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0)
  if (total >= 3600) {
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    return `${h}h ${m}m`
  }
  const minutes = Math.max(1, Math.round(total / 60) || 0)
  return `${minutes}m`
}

function shortCountdown(seconds) {
  const total = Math.max(0, Number(seconds) || 0)
  const m = Math.floor(total / 60)
  const s = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  if (total >= 3600) {
    const h = Math.floor(total / 3600)
    return `${pad(h)}:${pad(m % 60)}:${pad(s)}`
  }
  return `${pad(m)}:${pad(s)}`
}

function cloneCrimeEntry(entry = {}) {
  return {
    id: entry.id || `crime_${Date.now()}`,
    title: entry.title || 'Novo Crime',
    tag: entry.tag || '',
    description: entry.description || '',
    difficulty: entry.difficulty || 'Baixa',
    nerveCost: Number(entry.nerveCost ?? 0),
    cooldownSeconds: Number(entry.cooldownSeconds ?? 0),
    cashCost: Number(entry.cashCost ?? 0),
    payoutMin: Number(entry.payoutMin ?? 0),
    payoutMax: Number(entry.payoutMax ?? 0),
    status: entry.status || 'available',
    cta: entry.cta || 'Iniciar',
    icon: entry.icon || '🎯',
    lootNotes: entry.lootNotes || '',
    loot: Array.isArray(entry.loot) ? entry.loot.map((loot) => ({
      label: loot.label || 'Loot',
      type: loot.type === 'item' ? 'item' : 'money',
      chance: Number(loot.chance ?? 0),
      itemId: loot.itemId || '',
      min: Number(loot.min ?? 0),
      max: Number(loot.max ?? loot.min ?? 0),
    })) : [],
    events: {
      success: Array.isArray(entry?.events?.success) ? [...entry.events.success] : [],
      fail: Array.isArray(entry?.events?.fail) ? [...entry.events.fail] : [],
      critical: Array.isArray(entry?.events?.critical) ? [...entry.events.critical] : [],
    },
  }
}

const selectedCrime = computed(() => crimeCatalog.value.find((crime) => crime.id === selectedCrimeId.value) || null)

function selectCrime(id) {
  selectedCrimeId.value = id
}

function addCrime() {
  const crime = cloneCrimeEntry()
  crimeCatalog.value.push(crime)
  selectedCrimeId.value = crime.id
}

function duplicateCrime(id) {
  const source = crimeCatalog.value.find((crime) => crime.id === id)
  if (!source) return
  const copy = cloneCrimeEntry({ ...source, id: `${source.id}_copy` })
  crimeCatalog.value.push(copy)
  selectedCrimeId.value = copy.id
}

function deleteCrime(id) {
  if (crimeCatalog.value.length === 1) {
    toast.error('Mantém pelo menos um crime no catálogo')
    return
  }
  crimeCatalog.value = crimeCatalog.value.filter((crime) => crime.id !== id)
  if (!crimeCatalog.value.some((crime) => crime.id === selectedCrimeId.value)) {
    selectedCrimeId.value = crimeCatalog.value[0]?.id || ''
  }
}

function addLootEntry() {
  if (!selectedCrime.value) return
  selectedCrime.value.loot.push({
    label: 'Novo loot',
    type: 'money',
    chance: 50,
    min: 0,
    max: 0,
    itemId: '',
  })
}

function removeLootEntry(index) {
  if (!selectedCrime.value) return
  selectedCrime.value.loot.splice(index, 1)
}

function updateCrimeEvent(field, text) {
  if (!selectedCrime.value) return
  selectedCrime.value.events[field] = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function eventText(field) {
  if (!selectedCrime.value) return ''
  return (selectedCrime.value.events[field] || []).join('\n')
}

async function saveCrimeCatalog() {
  if (catalogSaving.value) return
  try {
    catalogSaving.value = true
    const payload = {
      crimes: crimeCatalog.value.map((crime) => ({
        ...crime,
        loot: crime.loot.map((loot) => ({
          label: loot.label,
          type: loot.type === 'item' ? 'item' : 'money',
          chance: Number(loot.chance ?? 0),
          itemId: loot.itemId,
          min: Number(loot.min ?? 0),
          max: Number(loot.max ?? 0),
        })),
        events: {
          success: crime.events.success,
          fail: crime.events.fail,
          critical: crime.events.critical,
        },
      })),
    }
    await api.post('/admin/world/config/crime-catalog', payload)
    toast.ok('Catálogo de crimes guardado')
  } catch (e) {
    toast.error(e?.response?.data?.error || 'Falha ao guardar catálogo de crimes')
  } finally {
    catalogSaving.value = false
  }
}

async function refreshPrisonOverview(force = false) {
  if (prisonOverview.loading && !force) return
  try {
    prisonOverview.loading = true
    const query = new URLSearchParams({ limit: '5', sort: 'time_desc' }).toString()
    const res = await api.get(`/world/prisoners?${query}`)
    prisonOverview.list = res.data?.prisoners || []
    prisonOverview.stats = res.data?.stats || prisonOverview.stats
    prisonOverview.lastFetched = new Date().toISOString()
    const eventsRes = await api.get('/world/prison/events?limit=5')
    prisonOverview.events = eventsRes.data?.events || []
  } catch (e) {
    toast.error(e?.response?.data?.error || 'Falha ao carregar estado da prisão')
  } finally {
    prisonOverview.loading = false
  }
}

async function refreshHospitalOverview(force = false) {
  if (hospitalOverview.loading && !force) return
  try {
    hospitalOverview.loading = true
    const query = new URLSearchParams({ limit: '5', sort: 'time_desc' }).toString()
    const res = await api.get(`/world/patients?${query}`)
    hospitalOverview.list = res.data?.patients || []
    hospitalOverview.stats = res.data?.stats || hospitalOverview.stats
    hospitalOverview.lastFetched = new Date().toISOString()
    const eventsRes = await api.get('/world/hospital/events?limit=5')
    hospitalOverview.events = eventsRes.data?.events || []
  } catch (e) {
    toast.error(e?.response?.data?.error || 'Falha ao carregar estado do hospital')
  } finally {
    hospitalOverview.loading = false
  }
}

async function hydrateWorldTab(force = false) {
  await Promise.all([
    loadWorldConfigs(force),
    refreshPrisonOverview(force || !prisonOverview.lastFetched),
    refreshHospitalOverview(force || !hospitalOverview.lastFetched),
  ])
}

async function forceJail(secondsOverride) {
  try {
    const target = ensureTarget()
    const jailTime = Math.max(60, Number((secondsOverride ?? worldConfigs.prison.defaultJailSeconds) || 3600))
    await api.patch('/admin/player/state', { targetUserId: target, jailed: true, jailTime })
    toast.ok('Jogador preso manualmente')
  } catch (e) {
    toast.error(e?.response?.data?.error || e?.message || 'Falha ao prender alvo')
  }
}

async function forceHospital(secondsOverride) {
  try {
    const target = ensureTarget()
    const hospitalTime = Math.max(60, Number((secondsOverride ?? worldConfigs.hospital.defaultHospitalSeconds) || 900))
    await api.patch('/admin/player/state', { targetUserId: target, hospitalized: true, hospitalTime })
    toast.ok('Jogador hospitalizado manualmente')
  } catch (e) {
    toast.error(e?.response?.data?.error || e?.message || 'Falha ao hospitalizar alvo')
  }
}

async function releaseTarget(kind) {
  try {
    const target = ensureTarget()
    const payload = { targetUserId: target }
    if (kind === 'prison') {
      payload.jailed = false
      payload.jailTime = 0
    } else if (kind === 'hospital') {
      payload.hospitalized = false
      payload.hospitalTime = 0
    }
    await api.patch('/admin/player/state', payload)
    toast.ok('Estado atualizado')
  } catch (e) {
    toast.error(e?.response?.data?.error || e?.message || 'Falha ao atualizar estado')
  }
}

watch(currentTab, (tab) => {
  if (tab === 'Mundo') {
    hydrateWorldTab()
  }
})

onMounted(() => {
  if (currentTab.value === 'Mundo') {
    hydrateWorldTab()
  }
})


// Cartel rep admin
function loadSavedIds(){
  try {
    const t = localStorage.getItem('nc_target_uid')
    const pid = localStorage.getItem('nc_target_pid')
    if (t) targetUserId.value = t
    if (pid) targetPlayerId.value = pid
  } catch {}
}

function onSaveIds(){
  try {
    if (targetUserId.value) localStorage.setItem('nc_target_uid', targetUserId.value)
    if (targetPlayerId.value) localStorage.setItem('nc_target_pid', targetPlayerId.value)
    alert('Saved')
  } catch(e) { toast.error(e?.message || e) }
}

function snapshotPresetData(){
  return {
    item: { ...item.value },
    effectJson: effectJson.value,
    overdoseJson: overdoseJson.value,
    passiveJson: passiveJson.value,
    ebEnable: { ...ebEnable.value },
    ebBonus: { ...ebBonus.value },
    ebCooldowns: { ...ebCooldowns.value },
    ebEnergy: ebEnergy.value,
    ebNerve: ebNerve.value,
    ebHappy: ebHappy.value,
    ebPoints: ebPoints.value,
    cacheMoneyMin: cacheMoneyMin.value,
    cacheMoneyMax: cacheMoneyMax.value,
    cacheMoneyChancePct: cacheMoneyChancePct.value,
    cachePointsMin: cachePointsMin.value,
    cachePointsMax: cachePointsMax.value,
    cachePointsChancePct: cachePointsChancePct.value,
    cacheItems: cacheItems.value.map(r => ({ ...r })),
  }
}

async function loadTitles(){
  try { const res = await api.get('/admin/player/titles'); titles.value = res.data?.titles || res.data || [] } catch {}
}

function useSearchPlayer(p){
  targetUserId.value = p.userId
  localStorage.setItem('nc_target_uid', p.userId)
  if (p.id) {
    targetPlayerId.value = String(p.id)
    localStorage.setItem('nc_target_pid', String(p.id))
  }
  hydrateSupportFlag()
  loadNotes()
}

let searchTimer = null
function onSearchDebounced(){ clearTimeout(searchTimer); searchTimer = setTimeout(onSearch, 350) }
async function onSearch(){
  try {
    const q = searchQuery.value.trim()
    if (!q) { searchResults.value = []; return }
    const res = await api.get(`/admin/players/search?q=${encodeURIComponent(q)}`)
    searchResults.value = res.data?.results || []
  } catch { searchResults.value = [] }
}

function ensureTarget(){
  const t = targetUserId.value?.trim()
  if (!t) throw new Error('Please load/select a target player first')
  return t
}

async function onLoadPlayer() {
  try {
    profileError.value = ''
    const pid = Number(targetPlayerId.value)
    if (!Number.isFinite(pid)) throw new Error('Informa um Player ID numérico para carregar o perfil')
    profileLoading.value = true
    const res = await api.get(`/admin/player/profile/${pid}`)
    const data = res.data || null
    if (!data) throw new Error('Perfil não encontrado')
    profile.value = data
    targetUserId.value = data.userId || ''
    syncStateFromProfile()
    toast.ok('Jogador carregado')
  } catch (e) {
    profile.value = null
    profileError.value = e?.response?.data?.error || e?.message || 'Falha ao carregar jogador'
    toast.error(profileError.value)
  } finally {
    profileLoading.value = false
  }
}

function syncStateFromProfile(){
  const data = profile.value
  if (!data) {
    newName.value = ''
    modStatus.value = 'Active'
    modRole.value = 'Player'
    modTitle.value = ''
    battle.value = { strength: 0, speed: 0, dexterity: 0, defense: 0 }
    work.value = { manuallabor: 0, intelligence: 0, endurance: 0, employeEfficiency: 0 }
    hydrateSupportFlag()
    return
  }

  newName.value = data.name || ''
  modStatus.value = data.playerStatus || 'Active'
  modRole.value = data.playerRole || 'Player'
  modTitle.value = data.playerTitle || ''
  battle.value = {
    strength: Number(data.battleStats?.strength || 0),
    speed: Number(data.battleStats?.speed || 0),
    dexterity: Number(data.battleStats?.dexterity || 0),
    defense: Number(data.battleStats?.defense || 0),
  }
  work.value = {
    manuallabor: Number(data.workStats?.manuallabor || 0),
    intelligence: Number(data.workStats?.intelligence || 0),
    endurance: Number(data.workStats?.endurance || 0),
    employeEfficiency: Number(data.workStats?.employeEfficiency || 0),
  }
  hydrateSupportFlag()
}

function normalizeNote(raw){
  if (!raw) return null
  const tags = Array.isArray(raw.tags) ? raw.tags.map(String) : []
  const type = tags.includes('system') ? 'system' : 'manual'
  return {
    ...raw,
    author: raw.authorName || raw.author || 'Sistema',
    type,
  }
}

async function loadNotes(){
  const target = targetUserId.value?.trim()
  if (!target) {
    notes.value = []
    return
  }
  try {
    const t = ensureTarget()
    const res = await api.get(`/admin/player/notes/${encodeURIComponent(t)}`)
    const list = (res.data?.notes || [])
      .map(normalizeNote)
      .filter(Boolean)
    notes.value = list
  } catch (e) {
    notes.value = []
    toast.error(e?.response?.data?.error || e?.message || 'Falha ao carregar notas')
  }
}

async function createNote(){
  try {
    const t = ensureTarget()
    const text = noteText.value.trim()
    if (!text) throw new Error('Escreva algo na nota')
    const payload = { targetUserId: t, text, tags: ['manual'] }
    const res = await api.post('/admin/player/notes', payload)
    const saved = normalizeNote(res.data?.note)
    if (saved) {
      notes.value = [saved, ...notes.value]
    } else {
      await loadNotes()
    }
    noteText.value = ''
    toast.ok('Nota guardada')
  } catch (e) {
    toast.error(e?.response?.data?.error || e?.message || 'Falha ao criar nota')
  }
}

async function applyName(){
  try {
    const t = ensureTarget()
    const name = newName.value?.trim()
    if (!name) throw new Error('Enter a name (3-32 chars)')
    const body = { targetUserId: t, name }
    const res = await api.patch('/admin/player/name', body)
    if (profile.value) profile.value.name = res.data?.name || name
    alert('Name updated')
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}

// Admin actions
async function applyCurrency(){
  try {
    const t = ensureTarget()
    const body = { targetUserId: t, ...currency.value }
    const res = await api.patch('/admin/currency', body)
    alert('Updated: ' + JSON.stringify(res.data || res))
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}
async function applyExp(){
  try {
    const t = ensureTarget()
    const body = { targetUserId: t, expDelta: Number(expDelta.value || 0) }
    const res = await api.patch('/admin/xp', body)
    alert('Exp: ' + JSON.stringify(res.data || res))
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}
async function applyLevel(){
  try {
    const t = ensureTarget()
    const body = { targetUserId: t, level: Number(levelSet.value || 1) }
    const res = await api.patch('/admin/level', body)
    alert('Level: ' + JSON.stringify(res.data || res))
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}
async function applyResources(){
  try {
    const t = ensureTarget()
    const body = { targetUserId: t, ...resources.value }
    const res = await api.patch('/admin/resources', body)
    alert('Resources: ' + JSON.stringify(res.data || res))
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}

async function applyBattleStats(){
  try {
    const t = ensureTarget()
    const body = { targetUserId: t, ...battle.value }
    const res = await api.patch('/admin/stats/battle', body)
    // update profile locally
    if (profile.value) profile.value.battleStats = res.data?.battleStats || profile.value.battleStats
    alert('Battle stats set')
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}

async function applyWorkStats(){
  try {
    const t = ensureTarget()
    const body = { targetUserId: t, ...work.value }
    const res = await api.patch('/admin/stats/work', body)
    if (profile.value) profile.value.workStats = res.data?.workStats || profile.value.workStats
    alert('Work stats set')
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}

// Quick resource maxers
function assertProfile(){ if (!profile.value) throw new Error('Load a target profile first') }
async function energyToMax(){
  try {
    assertProfile();
    const cur = Number(profile.value?.vitals?.energy||0), max = Number(profile.value?.vitals?.energyMax||0)
    if (!Number.isFinite(max)) throw new Error('No energy max available')
    resources.value.energyDelta = (max - cur)
    await applyResources()
  } catch(e){ alert(e?.message || 'Failed') }
}
async function nerveToMax(){
  try {
    assertProfile();
    const cur = Number(profile.value?.vitals?.nerve||0), max = Number(profile.value?.vitals?.nerveMax||0)
    if (!Number.isFinite(max)) throw new Error('No nerve max available')
    resources.value.nerveDelta = (max - cur)
    await applyResources()
  } catch(e){ alert(e?.message || 'Failed') }
}
async function happyToMax(){
  try {
    assertProfile();
    const cur = Number(profile.value?.vitals?.happy||0), max = Number(profile.value?.vitals?.happyMax||0)
    if (!Number.isFinite(max)) throw new Error('No happy max available')
    resources.value.happyDelta = (max - cur)
    await applyResources()
  } catch(e){ alert(e?.message || 'Failed') }
}

async function invAdd(){
  try {
    const t = ensureTarget()
    const body = { targetUserId: t, itemId: invItemId.value.trim(), qty: Number(invQty.value || 1) }
    const res = await api.post('/admin/inventory/add', body)
    invStatus.value = 'Inventory: ' + JSON.stringify(res.data || res)
    await onLoadPlayer()
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}
async function invRemove(){
  try {
    const t = ensureTarget()
    const body = { targetUserId: t, itemId: invItemId.value.trim(), qty: Number(invQty.value || 1) }
    const res = await api.post('/admin/inventory/remove', body)
    invStatus.value = 'Inventory: ' + JSON.stringify(res.data || res)
    await onLoadPlayer()
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}

async function adjustInventory(item, delta) {
  if (!item) return
  invItemId.value = resolveInventoryIdentifier(item)
  invQty.value = Math.max(1, Math.abs(delta))
  if (delta > 0) await invAdd()
  else await invRemove()
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(String(text || ''))
    toast.ok('ID copiado para a área de transferência')
  } catch {
    toast.error('Falha ao copiar ID')
  }
}

function buildEffectObject(){
  const obj = {}
  if (ebEnable.value.energy && Number(ebEnergy.value)) obj.energy = Number(ebEnergy.value)
  if (ebEnable.value.nerve && Number(ebNerve.value)) obj.nerve = Number(ebNerve.value)
  if (ebEnable.value.happy && Number(ebHappy.value)) obj.happy = Number(ebHappy.value)
  if (ebEnable.value.points && Number(ebPoints.value)) obj.points = Number(ebPoints.value)
  // Bonuses block
  const b = {}
  if (ebEnable.value.b_str && Number(ebBonus.value.strength)) b.strength = Number(ebBonus.value.strength)
  if (ebEnable.value.b_dex && Number(ebBonus.value.dexterity)) b.dexterity = Number(ebBonus.value.dexterity)
  if (ebEnable.value.b_spd && Number(ebBonus.value.speed)) b.speed = Number(ebBonus.value.speed)
  if (ebEnable.value.b_def && Number(ebBonus.value.defense)) b.defense = Number(ebBonus.value.defense)
  if (Object.keys(b).length) obj.bonuses = b
  // Cooldowns
  const cds = {}
  if (ebEnable.value.cdAlcohol && Number(ebCooldowns.value.alcohol)) cds.alcohol = Number(ebCooldowns.value.alcohol)
  if (ebEnable.value.cdBooster && Number(ebCooldowns.value.booster)) cds.booster = Number(ebCooldowns.value.booster)
  if (ebEnable.value.cdDrug && Number(ebCooldowns.value.drug)) cds.drug = Number(ebCooldowns.value.drug)
  if (ebEnable.value.cdMedical && Number(ebCooldowns.value.medical)) cds.medical = Number(ebCooldowns.value.medical)
  if (Object.keys(cds).length) obj.cooldowns = cds
  // Cache
  if (item.value.type === 'cache') {
    const cache = {}
    const min = Number(cacheMoneyMin.value||0)
    const max = Number(cacheMoneyMax.value||0)
    const chancePct = Number(cacheMoneyChancePct.value||0)
    if (min || max) {
      cache.money = { min, max: Math.max(min, max) }
      if (chancePct > 0) cache.moneyChance = Math.max(0, Math.min(100, chancePct)) / 100
    }
    // Points in cache
    const pMin = Number(cachePointsMin.value||0)
    const pMax = Number(cachePointsMax.value||0)
    const pChancePct = Number(cachePointsChancePct.value||0)
    if (pMin || pMax) {
      cache.points = { min: pMin, max: Math.max(pMin, pMax) }
      if (pChancePct > 0) cache.pointsChance = Math.max(0, Math.min(100, pChancePct)) / 100
    }
    const list = (cacheItems.value || [])
      .filter(r => (r?.id||'').trim())
      .map(r => {
        const o = { id: String(r.id).trim() }
        const qmin = Number(r.qtyMin||0), qmax = Number(r.qtyMax||0)
        if (qmin || qmax) { o.minQty = Math.max(1, qmin || 1); o.maxQty = Math.max(o.minQty, qmax || qmin || 1) }
        const cp = Number(r.chancePct||0)
        if (cp) o.chance = Math.max(0, Math.min(100, cp)) / 100
        return o
      })
      .filter(o => o.id)
    if (list.length) cache.items = list
    if (Object.keys(cache).length) obj.cache = cache
  }
  return obj
}
function applyEffectBuilder(){
  try { effectJson.value = JSON.stringify(buildEffectObject()) } catch {}
}
function loadEffectFromJson(){
  try {
    const obj = JSON.parse(effectJson.value || '{}')
    ebEnergy.value = Number(obj.energy||0); ebEnable.value.energy = 'energy' in obj
    ebNerve.value = Number(obj.nerve||0); ebEnable.value.nerve = 'nerve' in obj
    ebHappy.value = Number(obj.happy||0); ebEnable.value.happy = 'happy' in obj
    ebPoints.value = Number(obj.points||0); ebEnable.value.points = 'points' in obj
    const bon = obj.bonuses || {}
    ebBonus.value.strength = Number(bon.strength||0); ebEnable.value.b_str = 'strength' in bon
    ebBonus.value.dexterity = Number(bon.dexterity||0); ebEnable.value.b_dex = 'dexterity' in bon
    ebBonus.value.speed = Number(bon.speed||0); ebEnable.value.b_spd = 'speed' in bon
    ebBonus.value.defense = Number(bon.defense||0); ebEnable.value.b_def = 'defense' in bon
    const cds = obj.cooldowns || {}
    ebCooldowns.value.alcohol = Number(cds.alcohol||0); ebEnable.value.cdAlcohol = 'alcohol' in cds
    ebCooldowns.value.booster = Number(cds.booster||0); ebEnable.value.cdBooster = 'booster' in cds
    ebCooldowns.value.drug = Number(cds.drug||0); ebEnable.value.cdDrug = 'drug' in cds
    ebCooldowns.value.medical = Number(cds.medical||0); ebEnable.value.cdMedical = 'medical' in cds
    const cache = obj.cache || {}
    if (cache && typeof cache === 'object') {
      const m = cache.money
      if (typeof m === 'number') { cacheMoneyMin.value = m; cacheMoneyMax.value = m }
      else if (m && typeof m === 'object') {
        cacheMoneyMin.value = Number(m.min||0)
        cacheMoneyMax.value = Number(m.max||0)
      }
      cacheMoneyChancePct.value = Math.round((Number(cache.moneyChance||0) || 0) * 100)
      const p = cache.points
      if (typeof p === 'number') { cachePointsMin.value = p; cachePointsMax.value = p }
      else if (p && typeof p === 'object') {
        cachePointsMin.value = Number(p.min||0)
        cachePointsMax.value = Number(p.max||0)
      } else { cachePointsMin.value = 0; cachePointsMax.value = 0 }
      cachePointsChancePct.value = Math.round((Number(cache.pointsChance||0) || 0) * 100)
      cacheItems.value = Array.isArray(cache.items) ? cache.items.map(x => ({ id: x.id, qtyMin: x.minQty||x.qty||1, qtyMax: x.maxQty||x.qty||1, chancePct: Math.round((Number(x.chance||0)||0)*100) })) : []
    } else {
      cacheMoneyMin.value = 0; cacheMoneyMax.value = 0; cacheMoneyChancePct.value = 100; cacheItems.value = []
      cachePointsMin.value = 0; cachePointsMax.value = 0; cachePointsChancePct.value = 0
    }
  } catch {}
}
function presetXanax(){
  // Typical: drug with strong happy/energy, addiction, drug cooldown 12h
  ebEnable.value.energy = false; ebEnergy.value = 0
  ebEnable.value.nerve = false; ebNerve.value = 0
  ebEnable.value.happy = true; ebHappy.value = 2500
  ebEnable.value.points = false; ebPoints.value = 0
  ebEnable.value.cdDrug = true; ebCooldowns.value.drug = 12*3600
  applyEffectBuilder()
  item.value.type = 'drugs'
}
function presetEnergy250(){
  ebEnable.value.energy = true; ebEnergy.value = 250
  ebEnable.value.nerve = false; ebNerve.value = 0
  ebEnable.value.happy = false; ebHappy.value = 0
  ebEnable.value.points = false; ebPoints.value = 0
  ebEnable.value.cdBooster = true; ebCooldowns.value.booster = 3600
  applyEffectBuilder()
  item.value.type = 'enhancers'
}
function presetBoosterSmall(){
  ebEnable.value.energy = true; ebEnergy.value = 50
  ebEnable.value.nerve = true; ebNerve.value = 2
  ebEnable.value.happy = true; ebHappy.value = 250
  ebEnable.value.points = false; ebPoints.value = 0
  ebEnable.value.cdBooster = true; ebCooldowns.value.booster = 1800
  applyEffectBuilder()
  item.value.type = 'enhancers'
}

async function fetchItems(){
  try { const res = await api.get('/items'); items.value = res.data || [] } catch { items.value = [] }
}
async function loadItemPresets(){
  try {
    presetsLoading.value = true
    const res = await api.get('/admin/item-presets')
    itemPresets.value = res.data?.presets || []
  } catch {
    itemPresets.value = []
  } finally {
    presetsLoading.value = false
  }
}
async function deleteItem(id){
  try { await api.delete(`/items/${id}`); await fetchItems() } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}
function downloadAllItems(){
  // Navigate browser to trigger file download
  try {
    const base = (localStorage.getItem('nc_api') || '/api').replace(/\/$/, '')
    window.location.href = `${base}/items/download`
  } catch { /* no-op */ }
}

function addCacheItem(){ cacheItems.value.push({ id: '', qtyMin: 1, qtyMax: 1, chancePct: 100 }) }
function removeCacheItem(idx){ cacheItems.value.splice(idx, 1) }

async function createItem(){
  try {
    const payload = { ...item.value }
    // Map UI 'booster' to backend 'enhancers' type
    if (payload.type === 'booster') payload.type = 'enhancers'
    // attach type-specific JSONs
    if (['medicine','alchool','enhancers','drugs','cache'].includes(payload.type)) {
      payload.effect = effectJson.value ? JSON.parse(effectJson.value) : buildEffectObject()
    }
    if (['alchool','drugs'].includes(payload.type)) {
      payload.overdoseEffect = overdoseJson.value ? JSON.parse(overdoseJson.value) : {}
    }
    if (['tools','collectibles'].includes(payload.type)) {
      payload.passiveEffect = passiveJson.value ? JSON.parse(passiveJson.value) : {}
    }
    const res = await api.post('/items/create', payload)
    createItemStatus.value = 'Created: ' + JSON.stringify(res.data || res)
    await fetchItems()
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed creating item') }
}

async function stockAdd(){
  try {
    const t = ensureTarget()
    const body = { targetUserId: t, symbol: stockSymbol.value.trim().toUpperCase(), shares: Number(stockShares.value || 1) }
    if (stockAvgPrice.value != null && stockAvgPrice.value !== '') body.avgPrice = Number(stockAvgPrice.value)
    const res = await api.post('/admin/stocks/add', body)
    alert('Portfolio: ' + JSON.stringify(res.data || res))
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}
async function stockRemove(){
  try {
    const t = ensureTarget()
    const body = { targetUserId: t, symbol: stockSymbol.value.trim().toUpperCase(), shares: Number(stockShares.value || 1) }
    const res = await api.post('/admin/stocks/remove', body)
    alert('Portfolio: ' + JSON.stringify(res.data || res))
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}
async function stockCrash(){
  try {
    const body = {}
    const sym = stockSymbol.value.trim().toUpperCase()
    if (sym) body.symbol = sym
    const res = await api.post('/admin/stocks/crash', body)
    alert('Crash applied: ' + JSON.stringify(res.data || res))
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}
async function stockRocket(){
  try {
    const body = {}
    const sym = stockSymbol.value.trim().toUpperCase()
    if (sym) body.symbol = sym
    const res = await api.post('/admin/stocks/rocket', body)
    alert('Rocket applied: ' + JSON.stringify(res.data || res))
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}

async function loadAccounts(){
  try {
    const t = ensureTarget()
    const res = await api.get(`/bank/accounts/${encodeURIComponent(t)}`)
    bankAccounts.value = (res.data?.accounts || res.data || [])
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}
async function forceWithdraw(accountId){
  try {
    const t = ensureTarget()
    const body = { targetUserId: t, accountId }
    const res = await api.post('/admin/bank/force-withdraw', body)
    alert('Payout: ' + JSON.stringify(res.data || res))
    await loadAccounts()
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}

async function generalEnergyMax(){
  try {
    const includeNPC = String(generalIncludeNPC.value) === 'true'
    const res = await api.post('/admin/general/energy-max', { includeNPC })
    alert(`Energy set to max for ${(res.data?.modified||0)}/${(res.data?.matched||0)} players`)
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}
async function generalGiveMoney(){
  try {
    const includeNPC = String(generalIncludeNPC.value) === 'true'
    const amountVal = Number(generalMoneyAmount.value || 0)
    if (!Number.isFinite(amountVal) || amountVal === 0) throw new Error('Enter a non-zero amount')
    const res = await api.post('/admin/general/give-money', { includeNPC, amount: amountVal })
    alert(`Money updated (+${amountVal}) for ${(res.data?.modified||0)}/${(res.data?.matched||0)} players`)
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}

// Moderation
async function applyStatus(){
  try {
    const t = ensureTarget()
    const body = { targetUserId: t, status: modStatus.value }
    const res = await api.patch('/admin/player/status', body)
    alert('Status set: ' + JSON.stringify(res.data || res))
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}
async function applyRole(){
  try {
    const t = ensureTarget()
    const body = { targetUserId: t, role: modRole.value }
    const res = await api.patch('/admin/player/role', body)
    alert('Role set: ' + JSON.stringify(res.data || res))
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}
async function applyTitle(){
  try {
    const t = ensureTarget()
    const body = { targetUserId: t, title: modTitle.value }
    const res = await api.patch('/admin/player/title', body)
    alert('Title set: ' + JSON.stringify(res.data || res))
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}

async function applyPunishment(){
  try {
    const t = ensureTarget()
    if (!selectedPunishmentPreset.value) throw new Error('Select a preset first')
    const res = await api.patch('/admin/player/punishment', { targetUserId: t, preset: selectedPunishmentPreset.value })
    alert('Preset applied: ' + JSON.stringify(res.data?.applied || res.data || res))
    await loadNotes()
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}

function hydrateSupportFlag(){
  if (!profile.value) {
    supportFlagForm.value = { enabled: false, durationHours: 24, reason: '' }
    return
  }
  supportFlagForm.value = {
    enabled: !!profile.value.supportFlagUntil && new Date(profile.value.supportFlagUntil) > new Date(),
    durationHours: 24,
    reason: profile.value.supportFlagReason || '',
  }
}

async function saveSupportFlag(){
  try {
    const t = ensureTarget()
    const payload = {
      targetUserId: t,
      enabled: supportFlagForm.value.enabled,
      durationHours: supportFlagForm.value.durationHours,
      reason: supportFlagForm.value.reason,
    }
    const res = await api.patch('/admin/player/support-flag', payload)
    if (profile.value) {
      profile.value.supportFlagUntil = res.data?.supportFlagUntil || null
      profile.value.supportFlagReason = res.data?.supportFlagReason || null
    }
    alert('Support flag updated')
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}

// Cooldowns
async function cdLoad(){
  try {
    const t = ensureTarget()
    const res = await api.get(`/admin/player/cooldowns/${encodeURIComponent(t)}`)
    const cd = res.data?.cooldowns || {}
    const lines = [
      `drugCooldown: ${cd.drugCooldown||0}s`,
      `medicalCooldown: ${cd.medicalCooldown||0}s`,
      `boosterCooldown: ${cd.boosterCooldown||0}s`,
      `alcoholCooldown: ${cd.alcoholCooldown||0}s`,
    ]
    const perDrug = cd.drugs || {}
    if (Object.keys(perDrug).length) lines.push('per-drug: ' + JSON.stringify(perDrug))
    cdCurrentSummary.value = lines.join(' | ')
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}
async function cdSet(category){
  try {
    const t = ensureTarget()
    const map = { drug: cdDrug.value, medical: cdMedical.value, booster: cdBooster.value, alcohol: cdAlcohol.value }
    const body = { targetUserId: t, category, seconds: Number(map[category] || 0) }
    const res = await api.post('/admin/player/cooldowns/set', body)
    alert('Cooldown set: ' + JSON.stringify(res.data || res))
    await cdLoad()
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}
async function cdClear(scope){
  try {
    const t = ensureTarget()
    const body = { targetUserId: t, scope }
    const res = await api.post('/admin/player/cooldowns/clear', body)
    alert('Cooldowns cleared: ' + JSON.stringify(res.data || res))
    await cdLoad()
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}
async function cdResetAll(){
  try {
    const includeNPC = String(cdIncludeNPC.value) === 'true'
    const res = await api.post('/admin/cooldowns/reset-all', { includeNPC })
    alert(`Cooldowns reset for ${(res.data?.modified||0)}/${(res.data?.matched||0)} players`)
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}

// Database purge (danger)
async function dbPurge(){
  try {
    if (dbConfirm.value.trim() !== 'DROP') throw new Error('Type DROP to confirm')
    const res = await api.post('/admin/database/purge', { confirm: dbConfirm.value.trim() })
    alert('Database dropped: ' + JSON.stringify(res.data || res))
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}

// Cartel rep
async function applyCartelRep(){
  try {
    const t = ensureTarget()
    const body = { targetUserId: t }
    if (cartelRepExact.value != null && cartelRepExact.value !== '') {
      body.reputation = Number(cartelRepExact.value)
    } else if (cartelRepLevel.value >= 0) {
      body.repLevel = cartelRepLevel.value
    } else {
      throw new Error('Pick a rank or enter an exact rep value')
    }
    const res = await api.patch('/admin/cartel/rep', body)
    const d = res.data || {}
    cartelRepMsg.value = `${d.cartelName} → ${d.rankName} (lvl ${d.repLevel}, ${Number(d.reputation).toLocaleString()} rep)`
  } catch (e) {
    cartelRepMsg.value = ''
    alert(e?.response?.data?.error || e?.message || 'Failed')
  }
}

// Addiction
async function setAddiction(){
  try {
    const t = ensureTarget()
    const val = Math.max(0, Number(addictionValue.value||0))
    const body = { targetUserId: t, value: val }
    const res = await api.patch('/admin/player/addiction', body)
    alert('Addiction set: ' + JSON.stringify(res.data || res))
  } catch (e) { alert(e?.response?.data?.error || e?.message || 'Failed') }
}

// Boosts & logs helpers
async function fetchBoosts(){
  if (!targetUserId.value) { boosts.value = []; return }
  boostsLoading.value = true
  try {
    const t = ensureTarget()
    const res = await api.get(`/admin/player/boosts/${encodeURIComponent(t)}`)
    boosts.value = res.data?.boosts || []
  } catch (e) {
    toast.error(e?.response?.data?.error || e?.message || 'Falha ao carregar boosts')
  } finally {
    boostsLoading.value = false
  }
}

async function addBoost(){
  try {
    const t = ensureTarget()
    if (!boostForm.value.label.trim()) throw new Error('Nome do boost é obrigatório')
    let meta = {}
    const metaText = boostForm.value.metaJson?.trim()
    if (metaText) {
      try { meta = JSON.parse(metaText) }
      catch { throw new Error('Meta JSON inválido') }
    }
    const body = {
      targetUserId: t,
      label: boostForm.value.label.trim(),
      durationSeconds: Number(boostForm.value.durationSeconds || 0) || undefined,
      source: boostForm.value.source?.trim() || undefined,
      meta,
    }
    await api.post('/admin/player/boosts/add', body)
    boostForm.value = { label: '', durationSeconds: 0, source: '', metaJson: '' }
    await fetchBoosts()
    toast.ok('Boost adicionado')
  } catch (e) { toast.error(e?.response?.data?.error || e?.message || 'Falha ao adicionar boost') }
}

async function removeBoost(boostId){
  try {
    const t = ensureTarget()
    await api.post('/admin/player/boosts/remove', { targetUserId: t, boostId })
    boosts.value = boosts.value.filter(b => b._id !== boostId)
    toast.ok('Boost removido')
  } catch (e) {
    toast.error(e?.response?.data?.error || e?.message || 'Falha ao remover boost')
  }
}

async function fetchLogs(){
  if (!targetUserId.value) { logs.value = { snapshots: [], transactions: [] }; return }
  logsLoading.value = true
  try {
    const t = ensureTarget()
    const params = new URLSearchParams({
      txLimit: String(Math.max(5, Math.min(100, logsFilters.value.txLimit || 20))),
      snapshotLimit: String(Math.max(10, Math.min(200, logsFilters.value.snapshotLimit || 40))),
    })
    const res = await api.get(`/admin/player/logs/${encodeURIComponent(t)}?${params.toString()}`)
    logs.value = {
      snapshots: res.data?.snapshots || [],
      transactions: res.data?.transactions || [],
    }
    logsLastFetched.value = new Date()
  } catch (e) {
    toast.error(e?.response?.data?.error || e?.message || 'Falha ao carregar logs')
  } finally {
    logsLoading.value = false
  }
}

onMounted(() => { loadSavedIds(); loadTitles(); fetchItems(); loadItemPresets() })

watch(currentTab, async (tab) => {
  if (tab === 'Logs & Cooldowns' && targetUserId.value) {
    await Promise.allSettled([fetchBoosts(), fetchLogs(), cdLoad()])
  }
})

watch(profile, () => { syncStateFromProfile() }, { immediate: true })
watch(targetUserId, (val) => {
  if (val) {
    loadNotes()
    if (isLogsTab.value) {
      fetchBoosts()
      fetchLogs()
      cdLoad()
    }
  } else {
    notes.value = []
    boosts.value = []
    logs.value = { snapshots: [], transactions: [] }
    cdCurrentSummary.value = ''
  }
})
</script>

<style scoped>
.admin-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 20px 80px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 24px;
}
.section-block {
  background: rgba(255,255,255,0.02);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  padding-bottom: 12px;
}
.section-heading h3 {
  margin: 0;
  font-size: 1.3rem;
  letter-spacing: 0.01em;
}
.section-heading .muted {
  margin-top: 6px;
}
.section-meta {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.badge {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.eyebrow.mini {
  font-size: 10px;
  letter-spacing: 0.12em;
}
.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 11px;
  color: var(--muted);
  margin: 0 0 4px;
}
.admin-header h2 {
  margin: 0;
  font-size: 1.8rem;
}
.subtitle {
  margin: 4px 0 0;
  color: var(--muted);
}
.tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.card-grid {
  display: grid;
  gap: 16px;
}
.card-grid.two-col {
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}
.card-grid .card-full {
  grid-column: 1 / -1;
}
.tab-btn {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 13px;
  cursor: pointer;
}
.tab-btn.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.target-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}
.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  color: var(--text);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.card-header h3 {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 13px;
  color: var(--accent);
}
.card-header small {
  color: var(--muted);
  font-size: 11px;
}
.tab-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.profile-strip {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px 22px;
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}
.profile-strip h3 {
  margin: 0;
}
.profile-counters {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
}
.profile-counters .label {
  display: block;
  font-size: 11px;
  color: var(--muted);
  text-transform: uppercase;
}
.profile-counters .value {
  font-size: 15px;
  font-weight: 600;
}
.row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
label {
  display: block;
  font-size: 11px;
  color: var(--muted);
  margin-bottom: 3px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
input,
select,
textarea {
  width: 100%;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 10px;
  color: var(--text);
  font-family: inherit;
}
textarea {
  resize: vertical;
}
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 12px;
}
button {
  background: var(--accent);
  color: #fff;
  border: 1px solid var(--accent);
  padding: 8px 14px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 600;
}
button.secondary {
  background: transparent;
  color: var(--text);
  border-color: var(--border);
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.list {
  margin-top: 10px;
  border-top: 1px dashed var(--border);
  padding-top: 10px;
  font-size: 12px;
}
.snapshot-list ul,
.boost-list,
.tx-list,
.log-columns {
  list-style: none;
  margin: 0;
  padding: 0;
}
.log-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
}
.boost-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.boost-card,
.snapshot-card,
.tx-row {
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}
.snapshot-card,
.tx-row {
  flex-direction: column;
}
.snapshot-ts {
  font-weight: 600;
}
.value {
  font-weight: 600;
}
.empty-state {
  border: 1px dashed rgba(255,255,255,0.2);
  border-radius: 10px;
  padding: 14px;
  text-align: center;
  font-size: 13px;
  color: var(--muted);
  background: rgba(255,255,255,0.02);
}
.add-boost {
  margin-top: 16px;
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.world-config-card {
  background: rgba(11,14,30,0.8);
}
.world-sections {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
}
.world-sections.single {
  grid-template-columns: 1fr;
}
.world-sections section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 12px;
  padding: 18px;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}
.metrics .stat {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  padding: 10px;
}
.metrics .stat label {
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--muted);
}
.metrics .stat strong {
  font-size: 1.1rem;
}
.snapshot-list ul,
.snapshot-list li {
  list-style: none;
  margin: 0;
  padding: 0;
}
.snapshot-list ul {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.snapshot-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
}
.timer {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.section-block .card {
  background: rgba(8,10,20,0.9);
}
.log-columns h4 {
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 11px;
  color: var(--muted);
}
.boost-title {
  font-weight: 600;
}
.list-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  gap: 8px;
}
.muted {
  color: var(--muted);
  font-size: 12px;
}
.inline {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}
.pill {
  background: rgba(255,255,255,0.08);
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 11px;
}
.state-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
.toggle input {
  width: auto;
}
.stat-box {
  padding: 10px;
  border: 1px dashed var(--border);
  border-radius: 6px;
  font-weight: 600;
}
.note-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.notes-list {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.note-row {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.note-row header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.chip {
  padding: 4px 10px;
  border-radius: 999px;
}
.note-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.note-tags .pill {
  background: rgba(0,0,0,0.35);
  border: 1px solid rgba(255,255,255,0.12);
}
.target-card,
.search-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tab-panel .card h3 {
  margin-top: 0;
}
.card h3 {
  margin: 0 0 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 13px;
  color: var(--accent);
}
@media (max-width: 640px) {
  .tabs {
    width: 100%;
  }
  .tab-btn {
    flex: 1;
    text-align: center;
  }
}
</style>
