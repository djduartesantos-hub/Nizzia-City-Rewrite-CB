<template>
  <div class="casino-root" :class="{ 'vip-mode': vipMode }">

    <!-- Ambient background -->
    <div class="casino-bg">
      <div class="bg-grid"></div>
      <div class="bg-lights">
        <div class="light light-1"></div>
        <div class="light light-2"></div>
        <div class="light light-3"></div>
        <div class="light light-4"></div>
      </div>
      <div class="neon-strips">
        <div class="strip strip-top"></div>
        <div class="strip strip-bottom"></div>
      </div>
    </div>

    <!-- Casino Header -->
    <header class="casino-header">
      <div class="header-marquee">
        <span>🎰 NIZZIA GRAND CASINO 🎰 — BEM-VINDO AO SUBMUNDO — FORTUNE FAVORS THE BOLD — PLAY RESPONSIBLY — 🃏 DEALER ALWAYS WINS? NOT HERE — 🎲 ROLL THE DICE — 💎 VIP LOUNGE OPEN — 🎰 NIZZIA GRAND CASINO 🎰</span>
      </div>
      <div class="header-main">
        <div class="casino-logo">
          <span class="logo-icon">♠</span>
          <div class="logo-text">
            <span class="logo-main">NIZZIA GRAND</span>
            <span class="logo-sub">CASINO & RESORT</span>
          </div>
          <span class="logo-icon">♠</span>
        </div>
        <div class="header-stats">
          <div class="stat-chip">
            <span class="chip-icon">💰</span>
            <div>
              <span class="chip-label">Saldo</span>
              <span class="chip-value">${{ fmtNum(playerMoney) }}</span>
            </div>
          </div>
          <div class="stat-chip">
            <span class="chip-icon">⭐</span>
            <div>
              <span class="chip-label">Points</span>
              <span class="chip-value">{{ playerPoints }}</span>
            </div>
          </div>
          <div class="stat-chip vip-chip" :class="{ active: vipMode }" @click="vipMode = !vipMode">
            <span class="chip-icon">💎</span>
            <div>
              <span class="chip-label">Modo</span>
              <span class="chip-value">{{ vipMode ? 'VIP' : 'Normal' }}</span>
            </div>
          </div>
          <button class="sound-toggle" @click="toggleSound" :title="soundEnabled ? 'Mute' : 'Som'">
            {{ soundEnabled ? '🔊' : '🔇' }}
          </button>
        </div>
      </div>
      <!-- Game Navigation -->
      <nav class="game-nav">
        <button v-for="game in games" :key="game.id"
          class="game-tab"
          :class="{ active: activeGame === game.id, locked: game.locked }"
          @click="!game.locked && (activeGame = game.id)"
        >
          <span class="tab-icon">{{ game.icon }}</span>
          <span class="tab-label">{{ game.label }}</span>
          <span v-if="game.locked" class="tab-lock">🔒</span>
          <span v-if="game.badge" class="tab-badge">{{ game.badge }}</span>
        </button>
      </nav>
    </header>

    <!-- ═══════════════════════════════════════════ -->
    <!-- SLOT MACHINE -->
    <!-- ═══════════════════════════════════════════ -->
    <section v-if="activeGame === 'slots'" class="game-section">
      <div class="slot-machine-wrap">
        <div class="machine-body">
          <div class="machine-top">
            <div class="machine-title">
              <span>LUCKY</span><span class="gold-text">SEVEN</span>
            </div>
            <div class="jackpot-display">
              <span class="jackpot-label">JACKPOT</span>
              <span class="jackpot-amount">${{ fmtNum(jackpotAmount) }}</span>
            </div>
          </div>

          <!-- Reels -->
          <div class="reels-container" :class="{ spinning: slotsSpinning, 'win-flash': slotsWin }">
            <div class="reel-window">
              <div class="reel-mask"></div>
              <div v-for="(reel, ri) in slotReels" :key="ri" class="reel" :class="{ 'reel-stopped': reelsStopped[ri] }">
                <div class="reel-strip" :style="{ transform: `translateY(${reelOffsets[ri]}px)`, transition: reelTransitions[ri] }">
                  <div v-for="(sym, si) in reel.extended" :key="si" class="reel-symbol">
                    <span>{{ sym }}</span>
                  </div>
                </div>
              </div>
            </div>
            <!-- Win lines -->
            <div v-if="slotsWin" class="win-line win-line-center"></div>
          </div>

          <!-- Result display -->
          <div class="slot-result" :class="slotsResultClass">
            <template v-if="slotsResult">
              <span v-if="slotsResult.win" class="result-win">
                🎉 +${{ fmtNum(slotsResult.amount) }} — {{ slotsResult.combo }}
              </span>
              <span v-else-if="slotsResult.jackpot" class="result-jackpot">
                💎 JACKPOT! +${{ fmtNum(slotsResult.amount) }}
              </span>
              <span v-else class="result-lose">Sem sorte desta vez...</span>
            </template>
            <template v-else>
              <span class="result-idle">Seleciona a aposta e gira!</span>
            </template>
          </div>

          <!-- Controls -->
          <div class="slot-controls">
            <div class="bet-selector">
              <span class="bet-label">APOSTA</span>
              <div class="bet-chips">
                <button v-for="b in slotBets" :key="b"
                  class="bet-chip"
                  :class="{ active: slotBet === b }"
                  @click="slotBet = b"
                  :disabled="slotsSpinning"
                >
                  ${{ fmtNum(b) }}
                </button>
              </div>
            </div>
            <div class="spin-area">
              <button class="max-bet-btn" @click="slotBet = slotBets[slotBets.length-1]" :disabled="slotsSpinning">MAX</button>
              <button class="spin-btn" @click="spinSlots" :disabled="slotsSpinning || playerMoney < slotBet">
                <span v-if="slotsSpinning" class="spin-spinner">◐</span>
                <span v-else>GIRAR</span>
              </button>
            </div>
          </div>

          <!-- Paytable -->
          <div class="paytable-toggle" @click="showPaytable = !showPaytable">
            {{ showPaytable ? '▲' : '▼' }} Tabela de Prémios
          </div>
          <div v-if="showPaytable" class="paytable">
            <div class="pt-row" v-for="row in slotPaytable" :key="row.combo">
              <span class="pt-combo">{{ row.symbols }}</span>
              <span class="pt-label">{{ row.combo }}</span>
              <span class="pt-mult">×{{ row.mult }}</span>
            </div>
          </div>
        </div>

        <!-- Machine side decorations -->
        <div class="machine-lever" @click="!slotsSpinning && spinSlots()" :class="{ pulled: slotsSpinning }">
          <div class="lever-shaft"></div>
          <div class="lever-ball"></div>
        </div>
      </div>

      <!-- Slot History -->
      <div class="spin-history" v-if="slotHistory.length">
        <h4>Últimas jogadas</h4>
        <div class="history-list">
          <div v-for="(h, i) in slotHistory.slice(0,8)" :key="i"
            class="history-item"
            :class="{ 'h-win': h.win }"
          >
            <span class="h-symbols">{{ h.symbols }}</span>
            <span class="h-amount" :class="h.win ? 'h-pos' : 'h-neg'">
              {{ h.win ? '+' : '' }}${{ fmtNum(h.amount) }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════ -->
    <!-- ROULETTE -->
    <!-- ═══════════════════════════════════════════ -->
    <section v-if="activeGame === 'roulette'" class="game-section">
      <div class="roulette-layout">
        <div class="roulette-left">
          <!-- Wheel -->
          <div class="roulette-wheel-wrap">
            <div class="wheel-outer" :class="{ spinning: rouletteSpinning }">
              <div class="wheel-rim"></div>
              <div class="wheel-disc" :style="{ transform: `rotate(${wheelAngle}deg)`, transition: wheelTransition }">
                <div v-for="(seg, i) in rouletteSegments" :key="i"
                  class="wheel-segment"
                  :style="{ transform: `rotate(${i * (360/37)}deg)`, '--seg-color': seg.color }"
                >
                  <span class="seg-num">{{ seg.num }}</span>
                </div>
              </div>
              <div class="wheel-center">
                <div class="wheel-inner-ring"></div>
                <span class="wheel-logo">N</span>
              </div>
              <div class="wheel-ball" v-if="rouletteSpinning || rouletteResult !== null"></div>
              <div class="wheel-marker">▼</div>
            </div>
            <div class="roulette-result-display" v-if="rouletteResult !== null && !rouletteSpinning">
              <span class="r-num" :class="getNumColor(rouletteResult)">{{ rouletteResult }}</span>
              <span class="r-color">{{ rouletteResult === 0 ? 'Verde' : rouletteRed.includes(rouletteResult) ? 'Vermelho' : 'Preto' }}</span>
            </div>
          </div>

          <!-- Recent numbers -->
          <div class="recent-numbers">
            <span v-for="(n, i) in rouletteHistory.slice(0,12)" :key="i"
              class="recent-num"
              :class="getNumColor(n)"
            >{{ n }}</span>
          </div>
        </div>

        <div class="roulette-right">
          <!-- Bet amount -->
          <div class="r-bet-row">
            <span class="r-bet-label">Aposta: ${{ fmtNum(rouletteBet) }}</span>
            <div class="r-bet-chips">
              <button v-for="c in rouletteChips" :key="c.val"
                class="r-chip"
                :style="{ '--chip-color': c.color }"
                @click="rouletteBet = Math.min(playerMoney, rouletteBet + c.val)"
                :disabled="rouletteSpinning"
              >{{ c.label }}</button>
              <button class="r-chip r-chip-clear" @click="rouletteBet = 0; rouletteSelection = null" :disabled="rouletteSpinning">✕</button>
            </div>
          </div>

          <!-- Betting grid -->
          <div class="r-grid-wrap">
            <!-- Special bets -->
            <div class="r-special-bets">
              <button v-for="sb in rouletteSpecialBets" :key="sb.id"
                class="r-special"
                :class="{ selected: rouletteSelection?.id === sb.id }"
                @click="rouletteSelection = sb"
                :disabled="rouletteSpinning"
              >
                <span>{{ sb.label }}</span>
                <small>×{{ sb.payout }}</small>
              </button>
            </div>

            <!-- Number grid -->
            <div class="r-number-grid">
              <button class="r-num-btn r-zero"
                :class="{ selected: rouletteSelection?.type === 'number' && rouletteSelection?.value === 0 }"
                @click="selectNumber(0)"
                :disabled="rouletteSpinning"
              >0</button>
              <div class="r-nums">
                <button v-for="n in 36" :key="n"
                  class="r-num-btn"
                  :class="[getNumColor(n), { selected: rouletteSelection?.type === 'number' && rouletteSelection?.value === n }]"
                  @click="selectNumber(n)"
                  :disabled="rouletteSpinning"
                >{{ n }}</button>
              </div>
            </div>
          </div>

          <!-- Spin button -->
          <div class="r-action">
            <div class="r-selection-info" v-if="rouletteSelection">
              Aposta: <strong>{{ rouletteSelection.label }}</strong> — Potencial: <strong>${{ fmtNum(rouletteBet * rouletteSelection.payout) }}</strong>
            </div>
            <div class="r-selection-info muted" v-else>Seleciona um número ou tipo de aposta</div>
            <button class="r-spin-btn" @click="spinRoulette" :disabled="rouletteSpinning || !rouletteSelection || rouletteBet <= 0 || playerMoney < rouletteBet">
              <span v-if="rouletteSpinning">Girando...</span>
              <span v-else>LANÇAR BOLA — ${{ fmtNum(rouletteBet) }}</span>
            </button>
          </div>

          <!-- Result -->
          <div class="r-result" v-if="rouletteResultMsg" :class="rouletteResultWin ? 'r-win' : 'r-loss'">
            {{ rouletteResultMsg }}
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════ -->
    <!-- BLACKJACK -->
    <!-- ═══════════════════════════════════════════ -->
    <section v-if="activeGame === 'blackjack'" class="game-section">
      <div class="blackjack-table">
        <div class="table-felt">
          <div class="felt-logo">♠ BLACKJACK ♠</div>
          <div class="felt-rule">Dealer bate no 16, para no 17</div>
        </div>

        <!-- Dealer hand -->
        <div class="bj-area dealer-area">
          <div class="bj-label">DEALER <span class="bj-score" v-if="bjPhase !== 'betting'">{{ bjDealerScore }}</span></div>
          <div class="card-hand dealer-hand">
            <div v-for="(card, i) in bjDealerCards" :key="i"
              class="playing-card"
              :class="[card.face ? 'card-face' : 'card-back', getSuitColor(card.suit), `card-deal-${i}`]"
              :style="{ '--card-i': i }"
            >
              <template v-if="card.face">
                <span class="card-corner card-tl">{{ card.rank }}<br>{{ card.suit }}</span>
                <span class="card-center">{{ card.suit }}</span>
                <span class="card-corner card-br">{{ card.rank }}<br>{{ card.suit }}</span>
              </template>
              <template v-else>
                <div class="card-back-design"></div>
              </template>
            </div>
          </div>
        </div>

        <!-- Player hand -->
        <div class="bj-area player-area">
          <div class="bj-label">JOGADOR <span class="bj-score" :class="bjPlayerScore > 21 ? 'bust' : bjPlayerScore === 21 ? 'blackjack' : ''">{{ bjPlayerScore }}</span></div>
          <div class="card-hand player-hand">
            <div v-for="(card, i) in bjPlayerCards" :key="i"
              class="playing-card card-face"
              :class="[getSuitColor(card.suit), `card-deal-${i}`]"
              :style="{ '--card-i': i }"
            >
              <span class="card-corner card-tl">{{ card.rank }}<br>{{ card.suit }}</span>
              <span class="card-center">{{ card.suit }}</span>
              <span class="card-corner card-br">{{ card.rank }}<br>{{ card.suit }}</span>
            </div>
          </div>
        </div>

        <!-- Bet & Controls -->
        <div class="bj-controls">
          <div v-if="bjPhase === 'betting'" class="bj-betting">
            <div class="bj-bet-label">Aposta</div>
            <div class="bj-chips">
              <button v-for="c in bjChipValues" :key="c"
                class="bj-chip"
                @click="bjBet = Math.min(playerMoney, bjBet + c)"
              >${{ fmtNum(c) }}</button>
              <button class="bj-chip bj-chip-clear" @click="bjBet = 0">✕</button>
            </div>
            <div class="bj-current-bet">Aposta atual: <strong>${{ fmtNum(bjBet) }}</strong></div>
            <button class="bj-deal-btn" @click="dealBlackjack" :disabled="bjBet <= 0 || playerMoney < bjBet">
              DEAL — ${{ fmtNum(bjBet) }}
            </button>
          </div>

          <div v-else-if="bjPhase === 'player'" class="bj-actions">
            <button class="bj-btn bj-hit" @click="bjHit">HIT</button>
            <button class="bj-btn bj-stand" @click="bjStand">STAND</button>
            <button class="bj-btn bj-double" @click="bjDouble" :disabled="bjPlayerCards.length > 2 || playerMoney < bjBet">DOUBLE</button>
          </div>

          <div v-else-if="bjPhase === 'result'" class="bj-result-panel" :class="bjResultClass">
            <div class="bj-result-text">{{ bjResultMsg }}</div>
            <div class="bj-result-amount" v-if="bjResultAmount !== 0">
              {{ bjResultAmount > 0 ? '+' : '' }}${{ fmtNum(Math.abs(bjResultAmount)) }}
            </div>
            <button class="bj-new-game" @click="resetBlackjack">NOVA PARTIDA</button>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════ -->
    <!-- WHEEL OF FORTUNE (Casino Wheels) -->
    <!-- ═══════════════════════════════════════════ -->
    <section v-if="activeGame === 'wheels'" class="game-section">
      <div class="wof-container">
        <!-- Wheel selector -->
        <div class="wof-wheel-selector">
          <button v-for="w in casinoWheels" :key="w.id"
            class="wof-select-btn"
            :class="{ active: selectedWheel?.id === w.id, insufficient: playerMoney < w.cost }"
            @click="selectedWheel = w"
          >
            <span class="wsb-name">{{ w.name }}</span>
            <span class="wsb-cost">${{ fmtNum(w.cost) }}</span>
            <span class="wsb-cd" v-if="wheelCooldowns[w.id]">{{ formatCooldown(wheelCooldowns[w.id]) }}</span>
          </button>
        </div>

        <!-- Fortune Wheel -->
        <div class="fortune-wheel-wrap" v-if="selectedWheel">
          <div class="fw-title">{{ selectedWheel.name }}</div>

          <div class="fortune-wheel-outer">
            <div class="fw-pointer">▼</div>
            <div class="fortune-wheel" :style="{ transform: `rotate(${fortuneWheelAngle}deg)`, transition: fortuneWheelTransition }">
              <div v-for="(seg, i) in fortuneSegments" :key="i"
                class="fw-segment"
                :style="fortuneSegStyle(i, fortuneSegments.length, seg)"
              >
                <div class="fw-seg-content" :style="{ transform: `rotate(${(i * 360/fortuneSegments.length) + (180/fortuneSegments.length)}deg) translateX(75px)` }">
                  <span class="fw-seg-icon">{{ seg.icon }}</span>
                  <span class="fw-seg-label">{{ seg.label }}</span>
                </div>
              </div>
              <div class="fw-center-hub">
                <span>★</span>
              </div>
            </div>
          </div>

          <div class="fw-spin-area">
            <div class="fw-cost-info">Custo: <strong>${{ fmtNum(selectedWheel.cost) }}</strong> por giro</div>
            <div class="fw-cd-info" v-if="wheelCooldowns[selectedWheel.id]">
              ⏳ Próximo giro em {{ formatCooldown(wheelCooldowns[selectedWheel.id]) }}
            </div>
            <button class="fw-spin-btn"
              @click="spinFortuneWheel"
              :disabled="fortuneSpinning || playerMoney < selectedWheel.cost || !!wheelCooldowns[selectedWheel.id] || !isPrivileged && !!wheelCooldowns[selectedWheel.id]"
            >
              <span v-if="fortuneSpinning">A girar...</span>
              <span v-else>GIRAR — ${{ fmtNum(selectedWheel.cost) }}</span>
            </button>
          </div>

          <!-- Result -->
          <div class="fw-result" v-if="fortuneResult" :class="fortuneResult.type === 'lose' ? 'fw-loss' : 'fw-win'">
            <span class="fw-r-icon">{{ fortuneResult.icon }}</span>
            <div class="fw-r-text">
              <strong>{{ fortuneResult.label }}</strong>
              <span v-if="fortuneResult.value">{{ fortuneResultText }}</span>
            </div>
          </div>

          <!-- Segment legend -->
          <div class="fw-legend">
            <div v-for="seg in fortuneSegments" :key="seg.label" class="fw-legend-item">
              <span class="fw-legend-dot" :style="{ background: seg.color }"></span>
              <span>{{ seg.label }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════ -->
    <!-- DICE -->
    <!-- ═══════════════════════════════════════════ -->
    <section v-if="activeGame === 'dice'" class="game-section">
      <div class="dice-game">
        <div class="dice-arena">
          <div class="dice-table-felt">
            <div class="dice-title">CRAPS TABLE</div>
          </div>
          <div class="dice-container">
            <div v-for="(d, i) in diceValues" :key="i"
              class="die"
              :class="{ rolling: diceRolling, [`die-${d}`]: !diceRolling }"
            >
              <div class="die-face" :data-face="diceRolling ? '?' : d">
                <div class="die-dots" v-if="!diceRolling">
                  <span v-for="dot in getDiceDots(d)" :key="dot" class="dot"></span>
                </div>
                <span v-else class="die-rolling-icon">⚄</span>
              </div>
            </div>
          </div>
          <div class="dice-sum" v-if="!diceRolling && diceValues[0]">
            Total: <strong>{{ diceValues[0] + diceValues[1] }}</strong>
          </div>
        </div>

        <div class="dice-bets-panel">
          <div class="dice-bet-amount">
            <span>Aposta: ${{ fmtNum(diceBet) }}</span>
            <div class="dice-chips-row">
              <button v-for="c in diceChips" :key="c" class="dice-chip" @click="diceBet = Math.min(playerMoney, diceBet + c)" :disabled="diceRolling">${{ fmtNum(c) }}</button>
              <button class="dice-chip dice-clear" @click="diceBet = 100; dicePrediction = null" :disabled="diceRolling">✕</button>
            </div>
          </div>

          <div class="dice-predictions">
            <div class="dp-group">
              <div class="dp-label">RESULTADO EXATO (×6)</div>
              <div class="dp-btns">
                <button v-for="n in [2,3,4,5,6,7,8,9,10,11,12]" :key="n"
                  class="dp-btn"
                  :class="{ selected: dicePrediction?.type === 'exact' && dicePrediction?.value === n }"
                  @click="dicePrediction = { type: 'exact', value: n, payout: 6, label: `Soma ${n}` }"
                  :disabled="diceRolling"
                >{{ n }}</button>
              </div>
            </div>
            <div class="dp-group">
              <div class="dp-label">TIPO (×2)</div>
              <div class="dp-btns">
                <button class="dp-btn dp-wide" :class="{ selected: dicePrediction?.type === 'high' }" @click="dicePrediction = { type: 'high', payout: 2, label: 'Alto (8-12)' }" :disabled="diceRolling">Alto 8-12</button>
                <button class="dp-btn dp-wide" :class="{ selected: dicePrediction?.type === 'low' }" @click="dicePrediction = { type: 'low', payout: 2, label: 'Baixo (2-6)' }" :disabled="diceRolling">Baixo 2-6</button>
                <button class="dp-btn dp-wide" :class="{ selected: dicePrediction?.type === 'lucky7' }" @click="dicePrediction = { type: 'lucky7', payout: 5, label: '7 da Sorte' }" :disabled="diceRolling">Lucky 7 (×5)</button>
                <button class="dp-btn dp-wide" :class="{ selected: dicePrediction?.type === 'double' }" @click="dicePrediction = { type: 'double', payout: 8, label: 'Duplo' }" :disabled="diceRolling">Duplo (×8)</button>
              </div>
            </div>
          </div>

          <button class="dice-roll-btn" @click="rollDice" :disabled="diceRolling || !dicePrediction || diceBet <= 0 || playerMoney < diceBet">
            <span v-if="diceRolling">Rolando...</span>
            <span v-else>ROLAR — ${{ fmtNum(diceBet) }}</span>
          </button>

          <div class="dice-result" v-if="diceResult" :class="diceResult.win ? 'dice-win' : 'dice-loss'">
            <span>{{ diceResult.message }}</span>
            <strong>{{ diceResult.win ? '+' : '' }}${{ fmtNum(Math.abs(diceResult.payout)) }}</strong>
          </div>

          <!-- Dice history -->
          <div class="dice-history" v-if="diceHistory.length">
            <div v-for="(h, i) in diceHistory.slice(0,6)" :key="i" class="dh-item" :class="h.win ? 'dh-win' : 'dh-loss'">
              <span>{{ h.d1 }}+{{ h.d2 }}={{ h.d1+h.d2 }}</span>
              <span>{{ h.win ? '+' : '' }}${{ fmtNum(h.amount) }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════ -->
    <!-- COIN FLIP -->
    <!-- ═══════════════════════════════════════════ -->
    <section v-if="activeGame === 'coinflip'" class="game-section">
      <div class="coinflip-game">
        <div class="coin-arena">
          <div class="coin-container">
            <div class="coin" :class="{ flipping: coinFlipping, [`landed-${coinResult}`]: !coinFlipping && coinResult }">
              <div class="coin-face coin-heads">
                <span class="coin-symbol">♛</span>
                <span class="coin-text">HEADS</span>
              </div>
              <div class="coin-face coin-tails">
                <span class="coin-symbol">⚜</span>
                <span class="coin-text">TAILS</span>
              </div>
            </div>
          </div>
          <div class="coin-shadow"></div>
        </div>

        <div class="coinflip-panel">
          <div class="cf-title">CARA OU COROA</div>
          <div class="cf-subtitle">Dobra ou perde tudo. Simples assim.</div>

          <div class="cf-bet-row">
            <span class="cf-bet-label">Aposta: ${{ fmtNum(coinBet) }}</span>
            <div class="cf-chips">
              <button v-for="c in coinChips" :key="c" class="cf-chip" @click="coinBet = Math.min(playerMoney, coinBet + c)" :disabled="coinFlipping">${{ fmtNum(c) }}</button>
              <button class="cf-chip cf-clear" @click="coinBet = 100" :disabled="coinFlipping">✕</button>
            </div>
          </div>

          <div class="cf-choice">
            <button class="cf-side" :class="{ selected: coinChoice === 'heads' }" @click="coinChoice = 'heads'" :disabled="coinFlipping">
              <span class="cf-icon">♛</span>
              <span>HEADS</span>
              <small>×2</small>
            </button>
            <span class="cf-or">VS</span>
            <button class="cf-side" :class="{ selected: coinChoice === 'tails' }" @click="coinChoice = 'tails'" :disabled="coinFlipping">
              <span class="cf-icon">⚜</span>
              <span>TAILS</span>
              <small>×2</small>
            </button>
          </div>

          <button class="cf-flip-btn" @click="flipCoin" :disabled="coinFlipping || !coinChoice || coinBet <= 0 || playerMoney < coinBet">
            <span v-if="coinFlipping">Lançando...</span>
            <span v-else>LANÇAR — ${{ fmtNum(coinBet) }}</span>
          </button>

          <div class="cf-result" v-if="coinResultMsg" :class="coinResultWin ? 'cf-win' : 'cf-loss'">
            <div class="cf-r-label">{{ coinResult === 'heads' ? '♛ HEADS' : '⚜ TAILS' }}</div>
            <div class="cf-r-amount">{{ coinResultWin ? '🎉 +' : '💀 -' }}${{ fmtNum(Math.abs(coinBet)) }}</div>
            <div class="cf-r-msg">{{ coinResultMsg }}</div>
          </div>

          <!-- Streak display -->
          <div class="cf-streak" v-if="coinStreak > 1">
            🔥 Streak: <strong>{{ coinStreak }}</strong> {{ coinStreak >= 5 ? '— INSANO!' : coinStreak >= 3 ? '— Em chama!' : '' }}
          </div>

          <!-- Coin history dots -->
          <div class="cf-history" v-if="coinHistory.length">
            <span
              v-for="(h, i) in coinHistory.slice(-10).reverse()"
              :key="i"
              class="ch-dot"
              :class="h.win ? 'win' : 'loss'"
            >
              {{ h.result === 'heads' ? '♛' : '⚜' }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <transition name="win-notif">
      <div v-if="bigWinNotif" class="big-win-notif">
        <div class="bwn-content">
          <div class="bwn-label">BIG WIN</div>
          <div class="bwn-amount">+${{ fmtNum(bigWinAmount) }}</div>
          <div class="bwn-confetti">
            <span v-for="i in 12" :key="i" class="confetti-piece" :style="{ '--i': i }">✨</span>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import api from '../api/client'
import { usePlayer } from '../composables/usePlayer'
import { useToast } from '../composables/useToast'
import { fmt } from '../utils/format'

const { store, ensurePlayer, reloadPlayer } = usePlayer()
const toast = useToast()

const activeGame = ref('slots')
const games = [
  { id: 'slots', label: 'Slots', icon: '🎰' },
  { id: 'roulette', label: 'Roleta', icon: '🎡' },
  { id: 'blackjack', label: 'Blackjack', icon: '🃏' },
  { id: 'wheels', label: 'Fortune Wheel', icon: '🎯' },
  { id: 'dice', label: 'Dados', icon: '🎲' },
  { id: 'coinflip', label: 'Cara/Coroa', icon: '🪙' },
]

const vipMode = ref(false)
const soundEnabled = ref(true)
const showPaytable = ref(false)
const bigWinNotif = ref(false)
const bigWinAmount = ref(0)
const playerMoney = computed(() => Number(store.player?.money || 0))
const playerPoints = computed(() => Number(store.player?.points || 0))
const isPrivileged = computed(() => store.player?.playerRole === 'Admin' || store.player?.playerRole === 'Developer')

let audioCtx = null
function playTone(freq = 440, type = 'sine', duration = 0.08, gainValue = 0.12) {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    audioCtx = new Ctx()
  }
  const ctx = audioCtx
  if (!ctx) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, ctx.currentTime)
  g.gain.setValueAtTime(gainValue, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
  o.connect(g)
  g.connect(ctx.destination)
  o.start(ctx.currentTime)
  o.stop(ctx.currentTime + duration)
}

function playLoseSound() {
  playTone(200, 'sawtooth', 0.3, 0.2)
  setTimeout(() => playTone(150, 'sawtooth', 0.4, 0.15), 150)
}

function playSpinSound() {
  playTone(440, 'sine', 0.05, 0.15)
}

function playBigWinSound() {
  if (!soundEnabled.value) return
  const melody = [523, 784, 1047, 1319, 1047, 784, 1047, 1319]
  melody.forEach((n, i) => setTimeout(() => playTone(n, 'square', 0.15, 0.3), i * 100))
}

function playClickSound() {
  playTone(800, 'sine', 0.05, 0.1)
}

function toggleSound() {
  soundEnabled.value = !soundEnabled.value
  playClickSound()
}

// ─── Utility ─────────────────────────────────────────────────
function fmtNum(n) {
  const num = Number(n || 0)
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M'
  if (num >= 1_000) return (num / 1000).toFixed(1) + 'K'
  return num.toLocaleString()
}

function showBigWin(amount) {
  if (amount < 5000) return
  bigWinAmount.value = amount
  bigWinNotif.value = true
  playBigWinSound()
  setTimeout(() => { bigWinNotif.value = false }, 4000)
}

function updatePlayerMoney(amount) {
  store.mergePartial({ money: amount })
}

// ─── JACKPOT ─────────────────────────────────────────────────
const jackpotAmount = ref(250000)
let jackpotInterval = null

// ─── SLOT MACHINE ─────────────────────────────────────────────
const SLOT_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎', '7️⃣', '🔔', '🃏', '💰']
const slotBets = [100, 500, 1000, 5000, 10000, 50000]
const slotBet = ref(1000)
const slotsSpinning = ref(false)
const slotsWin = ref(false)
const slotsResult = ref(null)
const slotsResultClass = ref('')
const slotHistory = ref([])
const reelsStopped = ref([false, false, false])

const slotPaytable = [
  { symbols: '💎💎💎', combo: 'Diamond Royale', mult: 50 },
  { symbols: '7️⃣7️⃣7️⃣', combo: 'Lucky 777', mult: 25 },
  { symbols: '⭐⭐⭐', combo: 'Star Power', mult: 15 },
  { symbols: '🔔🔔🔔', combo: 'Big Bell', mult: 10 },
  { symbols: '🃏🃏🃏', combo: 'Wild Triple', mult: 8 },
  { symbols: '💰💰💰', combo: 'Money Bags', mult: 6 },
  { symbols: '🍒🍒🍒', combo: 'Cherry Pick', mult: 4 },
  { symbols: 'AAA', combo: 'Any Triple', mult: 3 },
  { symbols: 'AA?', combo: 'Any Double', mult: 1.5 },
]

// Build extended reel strips (3 visible + padding)
function makeReelStrip() {
  const strip = []
  for (let i = 0; i < 30; i++) strip.push(SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)])
  return strip
}

const slotReels = ref([
  { symbols: SLOT_SYMBOLS, extended: makeReelStrip(), result: '🍒' },
  { symbols: SLOT_SYMBOLS, extended: makeReelStrip(), result: '🍒' },
  { symbols: SLOT_SYMBOLS, extended: makeReelStrip(), result: '🍒' },
])

const SYMBOL_HEIGHT = 80
const reelOffsets = ref([0, 0, 0])
const reelTransitions = ref(['none', 'none', 'none'])

async function spinSlots() {
  if (slotsSpinning.value || playerMoney.value < slotBet.value) return
  playSpinSound()
  slotsSpinning.value = true
  slotsWin.value = false
  slotsResult.value = null
  slotsResultClass.value = ''
  reelsStopped.value = [false, false, false]

  // Deduct locally
  store.mergePartial({ money: playerMoney.value - slotBet.value })

  // Pick random results
  const results = slotReels.value.map(() => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)])

  // Animate each reel
  for (let ri = 0; ri < 3; ri++) {
    const extraSpins = 5 + ri * 2
    const totalSymbols = slotReels.value[ri].extended.length
    reelTransitions.value[ri] = `transform ${1.2 + ri * 0.4}s cubic-bezier(0.1, 0.8, 0.3, 1)`
    reelOffsets.value[ri] = -(totalSymbols - 3) * SYMBOL_HEIGHT

    // After animation ends, stop reel
    const delay = 1400 + ri * 450
    setTimeout(() => {
      reelsStopped.value[ri] = true
      slotReels.value[ri].result = results[ri]
      playTone(400 + ri * 100, 'sine', 0.1, 0.2)
    }, delay)
  }

  // Final result after all reels stop
  setTimeout(() => {
    slotsSpinning.value = false
    const outcome = computeSlotOutcome(results, slotBet.value)

    slotHistory.value.unshift({
      symbols: results.join(''),
      win: outcome.win,
      amount: outcome.win ? outcome.payout - slotBet.value : -slotBet.value
    })

    if (outcome.win) {
      slotsWin.value = true
      slotsResultClass.value = 'result-winning'
      slotsResult.value = { win: true, amount: outcome.payout, combo: outcome.combo }
      store.mergePartial({ money: playerMoney.value + outcome.payout })
      playWinSound()
      showBigWin(outcome.payout)
    } else {
      slotsResultClass.value = 'result-losing'
      slotsResult.value = { win: false }
      playLoseSound()
    }

    // Reset reel positions
    setTimeout(() => {
      reelTransitions.value = ['none', 'none', 'none']
      reelOffsets.value = [0, 0, 0]
      slotReels.value.forEach(r => { r.extended = makeReelStrip() })
    }, 500)
  }, 3200)
}

function computeSlotOutcome(results, bet) {
  const [a, b, c] = results
  // Triple match
  if (a === b && b === c) {
    const sym = a
    const mult = sym === '💎' ? 50 : sym === '7️⃣' ? 25 : sym === '⭐' ? 15 :
                 sym === '🔔' ? 10 : sym === '🃏' ? 8 : sym === '💰' ? 6 :
                 sym === '🍒' ? 4 : 3
    const combo = sym === '💎' ? 'Diamond Royale' : sym === '7️⃣' ? 'Lucky 777' : `Triple ${sym}`
    return { win: true, payout: bet * mult, combo }
  }
  // Double match
  if (a === b || b === c || a === c) {
    return { win: true, payout: Math.floor(bet * 1.5), combo: 'Double Match' }
  }
  // Cherry bonus (any cherry)
  if (results.includes('🍒')) {
    return { win: true, payout: Math.floor(bet * 0.5), combo: 'Cherry Bonus' }
  }
  return { win: false }
}

// ─── ROULETTE ────────────────────────────────────────────────
const rouletteRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]
const rouletteBet = ref(1000)
const rouletteSelection = ref(null)
const rouletteSpinning = ref(false)
const rouletteResult = ref(null)
const rouletteResultMsg = ref('')
const rouletteResultWin = ref(false)
const rouletteHistory = ref([])
const wheelAngle = ref(0)
const wheelTransition = ref('none')

const rouletteChips = [
  { val: 100, label: '100', color: '#3498db' },
  { val: 500, label: '500', color: '#e74c3c' },
  { val: 1000, label: '1K', color: '#2ecc71' },
  { val: 5000, label: '5K', color: '#f39c12' },
  { val: 10000, label: '10K', color: '#9b59b6' },
]

const rouletteSpecialBets = [
  { id: 'red', label: '🔴 Vermelho', type: 'color', value: 'red', payout: 2 },
  { id: 'black', label: '⚫ Preto', type: 'color', value: 'black', payout: 2 },
  { id: 'even', label: 'Par', type: 'parity', value: 'even', payout: 2 },
  { id: 'odd', label: 'Ímpar', type: 'parity', value: 'odd', payout: 2 },
  { id: 'low', label: '1-18', type: 'range', value: 'low', payout: 2 },
  { id: 'high', label: '19-36', type: 'range', value: 'high', payout: 2 },
  { id: 'dozen1', label: '1ª Dúzia', type: 'dozen', value: 1, payout: 3 },
  { id: 'dozen2', label: '2ª Dúzia', type: 'dozen', value: 2, payout: 3 },
  { id: 'dozen3', label: '3ª Dúzia', type: 'dozen', value: 3, payout: 3 },
]

// Build roulette segments
const rouletteSegments = computed(() => {
  const nums = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
  return nums.map(n => ({
    num: n,
    color: n === 0 ? '#16a34a' : rouletteRed.includes(n) ? '#dc2626' : '#1c1c1c'
  }))
})

function getNumColor(n) {
  if (n === 0) return 'num-green'
  return rouletteRed.includes(n) ? 'num-red' : 'num-black'
}

function selectNumber(n) {
  rouletteSelection.value = { id: `num_${n}`, type: 'number', value: n, label: `Número ${n}`, payout: n === 0 ? 36 : 36 }
}

async function spinRoulette() {
  if (rouletteSpinning.value || !rouletteSelection.value || rouletteBet.value <= 0) return
  rouletteSpinning.value = true
  rouletteResultMsg.value = ''

  store.mergePartial({ money: playerMoney.value - rouletteBet.value })

  // Spin animation
  const spins = 5 + Math.random() * 3
  const finalAngle = wheelAngle.value + (spins * 360) + Math.random() * 360
  wheelTransition.value = 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)'
  wheelAngle.value = finalAngle

  setTimeout(() => {
    const landed = Math.floor(Math.random() * 37)
    rouletteResult.value = landed
    rouletteHistory.value.unshift(landed)
    if (rouletteHistory.value.length > 20) rouletteHistory.value.pop()

    const won = checkRouletteWin(landed, rouletteSelection.value)
    const payout = won ? rouletteBet.value * rouletteSelection.value.payout : 0

    if (won) {
      rouletteResultMsg.value = `🎉 Ganhou! Número ${landed} — +$${fmtNum(payout)}`
      rouletteResultWin.value = true
      store.mergePartial({ money: playerMoney.value + payout })
      playWinSound()
      showBigWin(payout)
    } else {
      rouletteResultMsg.value = `Número ${landed} — Perdeu $${fmtNum(rouletteBet.value)}`
      rouletteResultWin.value = false
      playLoseSound()
    }

    rouletteSpinning.value = false
    wheelTransition.value = 'none'
  }, 4200)
}

function checkRouletteWin(landed, sel) {
  if (sel.type === 'number') return landed === sel.value
  if (sel.type === 'color') {
    if (landed === 0) return false
    return sel.value === 'red' ? rouletteRed.includes(landed) : !rouletteRed.includes(landed)
  }
  if (sel.type === 'parity') {
    if (landed === 0) return false
    return sel.value === 'even' ? landed % 2 === 0 : landed % 2 !== 0
  }
  if (sel.type === 'range') {
    if (landed === 0) return false
    return sel.value === 'low' ? landed <= 18 : landed >= 19
  }
  if (sel.type === 'dozen') {
    if (landed === 0) return false
    const d = Math.ceil(landed / 12)
    return d === sel.value
  }
  return false
}

// ─── BLACKJACK ───────────────────────────────────────────────
const bjPhase = ref('betting') // betting | player | dealer | result
const bjBet = ref(1000)
const bjPlayerCards = ref([])
const bjDealerCards = ref([])
const bjPlayerScore = computed(() => calcHandScore(bjPlayerCards.value.filter(c => c.face)))
const bjDealerScore = computed(() => calcHandScore(bjDealerCards.value.filter(c => c.face)))
const bjResultMsg = ref('')
const bjResultClass = ref('')
const bjResultAmount = ref(0)

const bjChipValues = [100, 500, 1000, 5000, 10000]
const SUITS = ['♠', '♥', '♦', '♣']
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

let bjDeck = []

function buildDeck() {
  bjDeck = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      bjDeck.push({ suit, rank, face: true, value: rankValue(rank) })
    }
  }
  // Shuffle
  for (let i = bjDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bjDeck[i], bjDeck[j]] = [bjDeck[j], bjDeck[i]]
  }
}

function rankValue(rank) {
  if (['J', 'Q', 'K'].includes(rank)) return 10
  if (rank === 'A') return 11
  return parseInt(rank)
}

function calcHandScore(cards) {
  let total = 0, aces = 0
  for (const c of cards) {
    total += c.value
    if (c.rank === 'A') aces++
  }
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return total
}

function getSuitColor(suit) {
  return ['♥', '♦'].includes(suit) ? 'card-red' : 'card-black'
}

function dealCard(face = true) {
  if (bjDeck.length < 5) buildDeck()
  const card = bjDeck.pop()
  return { ...card, face }
}

async function dealBlackjack() {
  if (bjBet.value <= 0 || playerMoney.value < bjBet.value) return
  buildDeck()
  store.mergePartial({ money: playerMoney.value - bjBet.value })
  playClickSound()

  bjPlayerCards.value = []
  bjDealerCards.value = []
  bjPhase.value = 'player'

  // Deal with animation delays
  setTimeout(() => { bjPlayerCards.value.push(dealCard()) }, 100)
  setTimeout(() => { bjDealerCards.value.push(dealCard()) }, 300)
  setTimeout(() => { bjPlayerCards.value.push(dealCard()) }, 500)
  setTimeout(() => { bjDealerCards.value.push(dealCard(false)) }, 700) // face down

  setTimeout(() => {
    if (bjPlayerScore.value === 21) {
      // Blackjack!
      resolveBlackjack('blackjack')
    }
  }, 900)
}

function bjHit() {
  bjPlayerCards.value.push(dealCard())
  playTone(440, 'sine', 0.08, 0.15)
  if (bjPlayerScore.value > 21) {
    setTimeout(() => resolveBlackjack('bust'), 300)
  } else if (bjPlayerScore.value === 21) {
    setTimeout(bjStand, 400)
  }
}

function bjStand() {
  // Reveal dealer card
  if (bjDealerCards.value.length > 1) bjDealerCards.value[1].face = true
  bjPhase.value = 'dealer'
  dealerPlay()
}

function bjDouble() {
  if (playerMoney.value < bjBet.value) return
  store.mergePartial({ money: playerMoney.value - bjBet.value })
  bjBet.value *= 2
  bjPlayerCards.value.push(dealCard())
  if (bjPlayerScore.value > 21) resolveBlackjack('bust')
  else bjStand()
}

function dealerPlay() {
  const deal = () => {
    if (bjDealerScore.value < 17) {
      setTimeout(() => {
        bjDealerCards.value.push(dealCard())
        playTone(300, 'sine', 0.08, 0.15)
        deal()
      }, 600)
    } else {
      setTimeout(() => resolveBlackjack('compare'), 400)
    }
  }
  deal()
}

function resolveBlackjack(reason) {
  let msg = '', cls = '', amount = 0

  const ps = bjPlayerScore.value
  const ds = bjDealerScore.value

  // Reveal hidden card
  bjDealerCards.value.forEach(c => c.face = true)

  if (reason === 'blackjack') {
    msg = '🎉 BLACKJACK! Pagamento 3:2'
    cls = 'bj-blackjack'
    amount = Math.floor(bjBet.value * 2.5)
    store.mergePartial({ money: playerMoney.value + amount })
    playBigWinSound()
  } else if (reason === 'bust') {
    msg = '💀 Bust! Passaste de 21'
    cls = 'bj-lose'
    amount = -bjBet.value
    playLoseSound()
  } else {
    if (ds > 21 || ps > ds) {
      msg = `🎉 Ganhou! ${ps} vs ${ds}`
      cls = 'bj-win'
      amount = bjBet.value
      store.mergePartial({ money: playerMoney.value + bjBet.value * 2 })
      playWinSound()
    } else if (ps === ds) {
      msg = `🤝 Empate — Aposta devolvida`
      cls = 'bj-push'
      amount = 0
      store.mergePartial({ money: playerMoney.value + bjBet.value })
    } else {
      msg = `💀 Dealer ganha. ${ps} vs ${ds}`
      cls = 'bj-lose'
      amount = -bjBet.value
      playLoseSound()
    }
  }

  bjResultMsg.value = msg
  bjResultClass.value = cls
  bjResultAmount.value = amount
  bjPhase.value = 'result'
  if (amount > 2000) showBigWin(amount)
}

function resetBlackjack() {
  bjPhase.value = 'betting'
  bjPlayerCards.value = []
  bjDealerCards.value = []
  bjResultMsg.value = ''
  bjResultAmount.value = 0
}

// ─── FORTUNE WHEEL (API) ──────────────────────────────────────
const casinoWheels = ref([])
const selectedWheel = ref(null)
const fortuneSpinning = ref(false)
const fortuneWheelAngle = ref(0)
const fortuneWheelTransition = ref('none')
const fortuneResult = ref(null)
const wheelCooldowns = ref({})

const fortuneResultText = computed(() => {
  if (!fortuneResult.value) return ''
  const r = fortuneResult.value
  if (r.type === 'money') return `+$${fmtNum(r.value)}`
  if (r.type === 'points') return `+${r.value} points`
  if (r.type === 'item') return `Item ganho!`
  if (r.type === 'lose') return 'Sem prémio'
  return r.value || ''
})

function fortuneSegStyle(i, total, seg) {
  const angle = (360 / total)
  return {
    transform: `rotate(${i * angle}deg)`,
    '--seg-angle': `${angle}deg`,
    '--seg-color': seg.color,
  }
}

const fortuneSegments = computed(() => {
  if (!selectedWheel.value) return []
  // Generate visual segments from wheel config
  const colors = ['#dc2626','#16a34a','#2563eb','#d97706','#7c3aed','#db2777','#0891b2','#ca8a04','#16a34a','#dc2626','#2563eb','#7c3aed']
  const baseSegs = [
    { label: 'Dinheiro', icon: '💰', color: colors[0], type: 'money' },
    { label: 'Item', icon: '🎁', color: colors[1], type: 'item' },
    { label: 'Points', icon: '⭐', color: colors[2], type: 'points' },
    { label: 'Nada', icon: '💨', color: '#374151', type: 'lose' },
    { label: 'Bónus', icon: '💎', color: colors[4], type: 'money' },
    { label: 'Sorte', icon: '🍀', color: colors[5], type: 'special' },
    { label: 'Dinheiro', icon: '💵', color: colors[6], type: 'money' },
    { label: 'Nada', icon: '🚫', color: '#374151', type: 'lose' },
    { label: 'Item Raro', icon: '🔮', color: colors[8], type: 'item' },
    { label: 'Jackpot!', icon: '🎰', color: colors[9], type: 'money' },
    { label: 'Points', icon: '🌟', color: colors[10], type: 'points' },
    { label: 'Prémio', icon: '🏆', color: colors[11], type: 'money' },
  ]
  return baseSegs
})

async function loadWheels() {
  try {
    const { data } = await api.get('/casino/wheels')
    casinoWheels.value = data?.wheels || []
    if (casinoWheels.value.length) selectedWheel.value = casinoWheels.value[0]

    // Check cooldowns from player
    const lastSpins = store.player?.casino?.lastSpins || {}
    const now = Date.now()
    for (const w of casinoWheels.value) {
      const last = lastSpins[w.id] ? new Date(lastSpins[w.id]).getTime() : null
      if (last) {
        const remaining = 24 * 3600 * 1000 - (now - last)
        if (remaining > 0) wheelCooldowns.value[w.id] = Math.ceil(remaining / 1000)
      }
    }
  } catch {
    casinoWheels.value = [
      { id: 'wheelLame', name: 'Roda da Sorte', cost: 1000 },
      { id: 'wheelMediocre', name: 'Roda de Prata', cost: 100000 },
      { id: 'wheelAwesome', name: 'Roda de Ouro', cost: 500000 },
    ]
    selectedWheel.value = casinoWheels.value[0]
  }
}

async function spinFortuneWheel() {
  if (fortuneSpinning.value || !selectedWheel.value) return
  fortuneSpinning.value = true
  fortuneResult.value = null

  store.mergePartial({ money: playerMoney.value - selectedWheel.value.cost })

  // Visual spin
  const spins = 5 + Math.random() * 5
  const finalAngle = fortuneWheelAngle.value + spins * 360 + Math.random() * 360
  fortuneWheelTransition.value = 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)'
  fortuneWheelAngle.value = finalAngle

  try {
    const { data } = await api.post('/casino/spin', { wheel: selectedWheel.value.id })

    setTimeout(() => {
      fortuneSpinning.value = false
      fortuneWheelTransition.value = 'none'

      const segs = fortuneSegments.value
      const r = data.reward

      // Map API reward to segment
      let matchedSeg = segs.find(s => s.type === r.type) || segs[0]
      fortuneResult.value = { ...matchedSeg, value: r.value, icon: matchedSeg.icon }

      // Update player
      store.mergePartial({ money: data.remainingMoney, points: data.points })

      if (r.type !== 'lose' && r.type !== 'special') {
        playWinSound()
        if (r.type === 'money') showBigWin(r.value)
      } else {
        playLoseSound()
      }

      // Set cooldown (24h)
      if (!isPrivileged.value) {
        wheelCooldowns.value[selectedWheel.value.id] = 24 * 3600
      }

    }, 4100)
  } catch (e) {
    setTimeout(() => {
      fortuneSpinning.value = false
      fortuneWheelTransition.value = 'none'
      const errMsg = e?.response?.data?.error || 'Erro ao girar'
      if (/Daily limit/.test(errMsg)) {
        const match = errMsg.match(/(\d+)h (\d+)m/)
        if (match) {
          wheelCooldowns.value[selectedWheel.value.id] = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60
        }
      }
      toast.error(errMsg)
      store.mergePartial({ money: playerMoney.value + selectedWheel.value.cost })
    }, 4100)
  }
}

function formatCooldown(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// Cooldown countdown
let cdInterval = null
function startCooldownTick() {
  cdInterval = setInterval(() => {
    for (const key of Object.keys(wheelCooldowns.value)) {
      wheelCooldowns.value[key] = Math.max(0, wheelCooldowns.value[key] - 1)
      if (wheelCooldowns.value[key] === 0) delete wheelCooldowns.value[key]
    }
  }, 1000)
}

// ─── DICE GAME ────────────────────────────────────────────────
const diceValues = ref([0, 0])
const diceRolling = ref(false)
const diceBet = ref(100)
const dicePrediction = ref(null)
const diceResult = ref(null)
const diceHistory = ref([])
const diceChips = [100, 500, 1000, 5000]

function getDiceDots(n) {
  return Array.from({ length: n }, (_, i) => i)
}

async function rollDice() {
  if (diceRolling.value || !dicePrediction.value || diceBet.value <= 0) return
  diceRolling.value = true
  diceResult.value = null

  store.mergePartial({ money: playerMoney.value - diceBet.value })

  // Roll animation
  const rollInterval = setInterval(() => {
    diceValues.value = [Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)]
    playTone(200 + Math.random() * 200, 'sine', 0.03, 0.05)
  }, 80)

  setTimeout(() => {
    clearInterval(rollInterval)
    const d1 = Math.ceil(Math.random() * 6)
    const d2 = Math.ceil(Math.random() * 6)
    diceValues.value = [d1, d2]
    diceRolling.value = false

    const sum = d1 + d2
    const pred = dicePrediction.value
    let won = false

    if (pred.type === 'exact' && sum === pred.value) won = true
    else if (pred.type === 'high' && sum >= 8) won = true
    else if (pred.type === 'low' && sum <= 6) won = true
    else if (pred.type === 'lucky7' && sum === 7) won = true
    else if (pred.type === 'double' && d1 === d2) won = true

    const payout = won ? diceBet.value * pred.payout : -diceBet.value

    diceResult.value = {
      win: won,
      message: won ? `✅ ${pred.label}! ` : `❌ Soma ${sum} — Perdeu`,
      payout: Math.abs(payout)
    }

    diceHistory.value.unshift({ d1, d2, win: won, amount: payout })
    if (diceHistory.value.length > 10) diceHistory.value.pop()

    if (won) {
      store.mergePartial({ money: playerMoney.value + diceBet.value * pred.payout })
      playWinSound()
      showBigWin(diceBet.value * pred.payout)
    } else {
      playLoseSound()
    }
  }, 1500)
}

// ─── COIN FLIP ────────────────────────────────────────────────
const coinFlipping = ref(false)
const coinResult = ref(null)
const coinBet = ref(100)
const coinChoice = ref(null)
const coinResultMsg = ref('')
const coinResultWin = ref(false)
const coinStreak = ref(0)
const coinHistory = ref([])
const coinChips = [100, 500, 1000, 5000, 10000]

async function flipCoin() {
  if (coinFlipping.value || !coinChoice.value || coinBet.value <= 0) return
  coinFlipping.value = true
  coinResult.value = null
  coinResultMsg.value = ''

  store.mergePartial({ money: playerMoney.value - coinBet.value })
  playTone(600, 'sine', 0.05, 0.1)

  setTimeout(() => {
    const landed = Math.random() < 0.5 ? 'heads' : 'tails'
    coinResult.value = landed
    coinFlipping.value = false

    const won = landed === coinChoice.value
    coinResultWin.value = won
    coinResultMsg.value = won ? 'Acertaste! Apostas dobradas!' : 'Errou. Mais sorte da próxima!'

    coinHistory.value.push({ result: landed, win: won })
    if (coinHistory.value.length > 20) coinHistory.value.shift()

    if (won) {
      coinStreak.value++
      store.mergePartial({ money: playerMoney.value + coinBet.value * 2 })
      playWinSound()
      showBigWin(coinBet.value * 2)
    } else {
      coinStreak.value = 0
      playLoseSound()
    }
  }, 2000)
}

// ─── Jackpot animation ────────────────────────────────────────
function startJackpotTick() {
  jackpotInterval = setInterval(() => {
    jackpotAmount.value += Math.floor(Math.random() * 50 + 10)
  }, 300)
}

// ─── Lifecycle ───────────────────────────────────────────────
onMounted(async () => {
  await ensurePlayer()
  await loadWheels()
  startJackpotTick()
  startCooldownTick()
})

onBeforeUnmount(() => {
  clearInterval(jackpotInterval)
  clearInterval(cdInterval)
  if (audioCtx.value) {
    audioCtx.value.close()
    audioCtx.value = null
  }
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Oswald:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap');

/* ═══════════════════════════════════════════════════
   CASINO ROOT & BACKGROUND
   ═══════════════════════════════════════════════════ */
.casino-root {
  min-height: 100vh;
  position: relative;
  font-family: 'Oswald', sans-serif;
  color: #f0e6c8;
  overflow-x: hidden;
  --gold: #f6b756;
  --gold-dark: #c8860e;
  --gold-light: #ffd980;
  --felt: #0d4a2a;
  --felt-light: #155c34;
  --card-back: #1a237e;
  --neon-r: #ff2244;
  --neon-g: #00ff88;
  --casino-bg: #080a0c;
}

.casino-root.vip-mode {
  --gold: #fff0a0;
  --neon-g: #ffe066;
}

.casino-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  background: #080a0c;
  pointer-events: none;
}

.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(246, 183, 86, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(246, 183, 86, 0.03) 1px, transparent 1px);
  background-size: 40px 40px;
}

.bg-lights { position: absolute; inset: 0; }
.light {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.12;
  animation: lightPulse 4s ease-in-out infinite;
}
.light-1 { width: 400px; height: 400px; background: #f6b756; top: -100px; left: -100px; animation-delay: 0s; }
.light-2 { width: 300px; height: 300px; background: #dc2626; top: 30%; right: -50px; animation-delay: 1s; }
.light-3 { width: 350px; height: 350px; background: #16a34a; bottom: -100px; left: 40%; animation-delay: 2s; }
.light-4 { width: 250px; height: 250px; background: #7c3aed; bottom: 20%; right: 20%; animation-delay: 3s; }

@keyframes lightPulse {
  0%, 100% { opacity: 0.08; transform: scale(1); }
  50% { opacity: 0.18; transform: scale(1.1); }
}

.neon-strips { position: absolute; inset: 0; }
.strip {
  position: absolute;
  left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--gold), transparent);
}
.strip-top { top: 60px; animation: stripGlow 3s ease-in-out infinite; }
.strip-bottom { bottom: 0; animation: stripGlow 3s ease-in-out infinite reverse; }
@keyframes stripGlow {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.8; box-shadow: 0 0 20px var(--gold); }
}

/* ═══════════════════════════════════════════════════
   HEADER
   ═══════════════════════════════════════════════════ */
.casino-header {
  position: relative;
  z-index: 10;
  background: linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(8,10,12,0.9) 100%);
  border-bottom: 2px solid var(--gold);
  box-shadow: 0 0 30px rgba(246, 183, 86, 0.2);
}

.header-marquee {
  background: #0a0800;
  border-bottom: 1px solid rgba(246,183,86,0.2);
  overflow: hidden;
  padding: 6px 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--gold);
  letter-spacing: 0.05em;
}

.header-marquee span {
  display: inline-block;
  white-space: nowrap;
  animation: marquee 30s linear infinite;
}

@keyframes marquee {
  from { transform: translateX(100vw); }
  to { transform: translateX(-100%); }
}

.header-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.casino-logo {
  display: flex;
  align-items: center;
  gap: 14px;
}

.logo-icon {
  font-size: 32px;
  color: var(--gold);
  text-shadow: 0 0 20px var(--gold);
  animation: iconGlow 2s ease-in-out infinite alternate;
}

@keyframes iconGlow {
  from { text-shadow: 0 0 10px var(--gold); }
  to { text-shadow: 0 0 30px var(--gold), 0 0 60px rgba(246,183,86,0.5); }
}

.logo-text {
  display: flex;
  flex-direction: column;
}

.logo-main {
  font-family: 'Playfair Display', serif;
  font-size: 28px;
  font-weight: 900;
  background: linear-gradient(135deg, #f6b756, #ffd980, #c8860e, #f6b756);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 0.08em;
}

.logo-sub {
  font-size: 11px;
  letter-spacing: 0.25em;
  color: rgba(246,183,86,0.6);
  text-transform: uppercase;
}

.header-stats {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.stat-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(246,183,86,0.08);
  border: 1px solid rgba(246,183,86,0.2);
  border-radius: 10px;
  padding: 8px 14px;
  cursor: default;
}

.stat-chip.vip-chip {
  cursor: pointer;
  transition: all 0.2s;
}

.stat-chip.vip-chip:hover, .stat-chip.vip-chip.active {
  background: rgba(246,183,86,0.2);
  border-color: var(--gold);
  box-shadow: 0 0 15px rgba(246,183,86,0.3);
}

.chip-icon { font-size: 18px; }

.chip-label {
  display: block;
  font-size: 9px;
  letter-spacing: 0.12em;
  color: rgba(240,230,200,0.5);
  text-transform: uppercase;
}

.chip-value {
  display: block;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 600;
  color: var(--gold);
}

.sound-toggle {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s;
  color: inherit;
}
.sound-toggle:hover { background: rgba(255,255,255,0.1); }

/* Game Nav */
.game-nav {
  display: flex;
  gap: 0;
  border-top: 1px solid rgba(246,183,86,0.15);
  overflow-x: auto;
}

.game-tab {
  flex: 1;
  min-width: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  background: transparent;
  border: none;
  border-bottom: 3px solid transparent;
  color: rgba(240,230,200,0.5);
  cursor: pointer;
  font-family: 'Oswald', sans-serif;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transition: all 0.2s;
  position: relative;
}

.game-tab:hover { color: var(--gold); background: rgba(246,183,86,0.05); }
.game-tab.active {
  color: var(--gold);
  border-bottom-color: var(--gold);
  background: rgba(246,183,86,0.08);
}
.game-tab.locked { opacity: 0.4; cursor: not-allowed; }

.tab-icon { font-size: 20px; }
.tab-label { font-size: 10px; }
.tab-badge {
  position: absolute;
  top: 6px; right: 6px;
  background: var(--neon-r);
  color: white;
  font-size: 8px;
  padding: 2px 5px;
  border-radius: 999px;
}

/* ═══════════════════════════════════════════════════
   GAME SECTION
   ═══════════════════════════════════════════════════ */
.game-section {
  position: relative;
  z-index: 5;
  padding: 32px 20px 60px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: calc(100vh - 180px);
}

/* ═══════════════════════════════════════════════════
   SLOT MACHINE
   ═══════════════════════════════════════════════════ */
.slot-machine-wrap {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 32px;
}

.machine-body {
  background: linear-gradient(160deg, #1a1208 0%, #0d0a04 100%);
  border: 3px solid var(--gold);
  border-radius: 24px;
  padding: 28px;
  max-width: 600px;
  width: 100%;
  box-shadow:
    0 0 40px rgba(246,183,86,0.15),
    inset 0 0 60px rgba(0,0,0,0.5);
}

.machine-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.machine-title {
  font-family: 'Playfair Display', serif;
  font-size: 28px;
  display: flex;
  gap: 8px;
}

.gold-text {
  color: var(--gold);
  text-shadow: 0 0 20px rgba(246,183,86,0.6);
}

.jackpot-display {
  text-align: right;
  background: #000;
  border: 2px solid var(--gold);
  border-radius: 10px;
  padding: 8px 16px;
}

.jackpot-label {
  display: block;
  font-size: 9px;
  letter-spacing: 0.2em;
  color: var(--gold);
}

.jackpot-amount {
  display: block;
  font-family: 'JetBrains Mono', monospace;
  font-size: 18px;
  color: var(--gold);
  text-shadow: 0 0 15px var(--gold);
  animation: jackpotPulse 0.3s ease-in-out;
}

@keyframes jackpotPulse {
  from { transform: scale(1); }
  50% { transform: scale(1.05); }
  to { transform: scale(1); }
}

/* Reels */
.reels-container {
  background: #000;
  border: 3px solid rgba(246,183,86,0.4);
  border-radius: 14px;
  overflow: hidden;
  position: relative;
  margin-bottom: 16px;
}

.reels-container.spinning .reel-symbol {
  filter: blur(2px);
}

.reels-container.win-flash {
  animation: winFlash 0.4s ease-in-out 3;
}

@keyframes winFlash {
  0%, 100% { border-color: rgba(246,183,86,0.4); box-shadow: none; }
  50% { border-color: var(--gold); box-shadow: 0 0 30px rgba(246,183,86,0.6); }
}

.reel-window {
  display: flex;
  height: 240px;
  overflow: hidden;
  position: relative;
}

.reel-mask {
  position: absolute;
  inset: 0;
  z-index: 3;
  background: linear-gradient(180deg,
    rgba(0,0,0,0.8) 0%,
    transparent 20%,
    transparent 80%,
    rgba(0,0,0,0.8) 100%
  );
  pointer-events: none;
}

.reel {
  flex: 1;
  position: relative;
  border-right: 1px solid rgba(246,183,86,0.15);
  overflow: hidden;
}

.reel:last-child { border-right: none; }

.reel-strip {
  display: flex;
  flex-direction: column;
}

.reel-symbol {
  width: 100%;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  transition: none;
}

.reel.reel-stopped .reel-symbol:nth-child(3) {
  background: rgba(246,183,86,0.06);
}

.win-line {
  position: absolute;
  left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent, var(--gold), transparent);
  pointer-events: none;
  box-shadow: 0 0 12px var(--gold);
  animation: winLinePulse 0.5s ease-in-out infinite;
  z-index: 4;
}

.win-line-center { top: 50%; transform: translateY(-50%); }

@keyframes winLinePulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; box-shadow: 0 0 20px var(--gold); }
}

/* Slot result */
.slot-result {
  text-align: center;
  min-height: 36px;
  padding: 8px;
  border-radius: 8px;
  font-size: 14px;
  letter-spacing: 0.05em;
  margin-bottom: 16px;
  transition: all 0.3s;
}

.result-idle { color: rgba(240,230,200,0.4); }
.result-win { color: var(--gold); font-size: 16px; font-weight: 700; }
.result-jackpot { color: #fff; font-size: 20px; font-weight: 900; text-shadow: 0 0 20px var(--gold); animation: jackpotText 0.5s ease-in-out infinite alternate; }
.result-lose { color: rgba(240,230,200,0.5); }
.result-winning { background: rgba(246,183,86,0.08); border: 1px solid rgba(246,183,86,0.3); }
.result-losing { background: rgba(255,34,68,0.05); }

@keyframes jackpotText {
  from { transform: scale(1); }
  to { transform: scale(1.05); }
}

/* Controls */
.slot-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 16px;
}

.bet-selector { flex: 1; min-width: 220px; }

.bet-label {
  display: block;
  font-size: 9px;
  letter-spacing: 0.15em;
  color: rgba(240,230,200,0.4);
  margin-bottom: 8px;
}

.bet-chips { display: flex; gap: 6px; flex-wrap: wrap; }

.bet-chip {
  background: rgba(246,183,86,0.08);
  border: 1px solid rgba(246,183,86,0.2);
  border-radius: 8px;
  padding: 6px 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: rgba(240,230,200,0.7);
  cursor: pointer;
  transition: all 0.15s;
}

.bet-chip:hover { background: rgba(246,183,86,0.15); color: var(--gold); }
.bet-chip.active {
  background: rgba(246,183,86,0.2);
  border-color: var(--gold);
  color: var(--gold);
  box-shadow: 0 0 10px rgba(246,183,86,0.2);
}
.bet-chip:disabled { opacity: 0.4; cursor: not-allowed; }

.spin-area { display: flex; gap: 8px; align-items: center; }

.max-bet-btn {
  background: rgba(255,34,68,0.1);
  border: 1px solid rgba(255,34,68,0.3);
  border-radius: 8px;
  padding: 10px 14px;
  font-family: 'Oswald', sans-serif;
  font-size: 12px;
  letter-spacing: 0.1em;
  color: #ff6b6b;
  cursor: pointer;
  transition: all 0.2s;
}
.max-bet-btn:hover { background: rgba(255,34,68,0.2); }
.max-bet-btn:disabled { opacity: 0.4; }

.spin-btn {
  background: linear-gradient(135deg, var(--gold-dark), var(--gold), var(--gold-light));
  border: none;
  border-radius: 12px;
  padding: 14px 32px;
  font-family: 'Oswald', sans-serif;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #1a0e00;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 20px rgba(246,183,86,0.3);
}
.spin-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(246,183,86,0.4); }
.spin-btn:active { transform: translateY(0); }
.spin-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

.spin-spinner { animation: spinIcon 0.5s linear infinite; display: inline-block; }
@keyframes spinIcon { to { transform: rotate(360deg); } }

/* Paytable */
.paytable-toggle {
  font-size: 11px;
  letter-spacing: 0.1em;
  color: rgba(240,230,200,0.4);
  cursor: pointer;
  text-align: center;
  padding: 6px;
  transition: color 0.2s;
}
.paytable-toggle:hover { color: var(--gold); }

.paytable {
  margin-top: 12px;
  background: rgba(0,0,0,0.4);
  border-radius: 10px;
  overflow: hidden;
}

.pt-row {
  display: grid;
  grid-template-columns: 120px 1fr auto;
  gap: 8px;
  padding: 8px 14px;
  border-bottom: 1px solid rgba(246,183,86,0.07);
  font-size: 13px;
  align-items: center;
}
.pt-row:last-child { border-bottom: none; }
.pt-combo { color: rgba(240,230,200,0.6); font-size: 11px; }
.pt-mult { color: var(--gold); font-weight: 700; font-family: 'JetBrains Mono', monospace; }

/* Lever */
.machine-lever {
  width: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  cursor: pointer;
  margin-top: 60px;
  user-select: none;
}

.lever-shaft {
  width: 8px;
  height: 120px;
  background: linear-gradient(90deg, #888, #ccc, #888);
  border-radius: 4px;
  transition: transform 0.3s;
  transform-origin: bottom center;
}

.machine-lever.pulled .lever-shaft {
  transform: rotate(30deg);
}

.lever-ball {
  width: 28px;
  height: 28px;
  background: radial-gradient(circle at 35% 35%, #ff6666, #cc0000);
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.2);
  box-shadow: 0 4px 10px rgba(0,0,0,0.4);
  transition: transform 0.3s;
}

.machine-lever.pulled .lever-ball {
  transform: translateY(80px);
}

.machine-lever:hover .lever-ball {
  box-shadow: 0 4px 20px rgba(255,0,0,0.4);
}

/* Spin history */
.spin-history {
  max-width: 600px;
  margin: 0 auto;
}

.spin-history h4 {
  font-size: 11px;
  letter-spacing: 0.15em;
  color: rgba(240,230,200,0.4);
  margin-bottom: 10px;
}

.history-list { display: flex; flex-direction: column; gap: 6px; }

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 14px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  transition: border-color 0.2s;
}

.history-item.h-win { border-color: rgba(246,183,86,0.2); }

.h-symbols { font-size: 18px; }
.h-pos { color: var(--gold); }
.h-neg { color: rgba(255,107,107,0.7); }

/* ═══════════════════════════════════════════════════
   ROULETTE
   ═══════════════════════════════════════════════════ */
.roulette-layout {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 32px;
  align-items: start;
}

.roulette-wheel-wrap { display: flex; flex-direction: column; align-items: center; gap: 16px; }

.wheel-outer {
  position: relative;
  width: 360px;
  height: 360px;
}

.wheel-rim {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(
    #c8a000 0deg 10deg,
    #1a1a1a 10deg 20deg,
    #c8a000 20deg 30deg,
    #1a1a1a 30deg 40deg,
    #c8a000 40deg 50deg,
    #1a1a1a 50deg 60deg,
    #c8a000 60deg 70deg,
    #1a1a1a 70deg 80deg,
    #c8a000 80deg 90deg,
    #1a1a1a 90deg 100deg,
    #c8a000 100deg 110deg,
    #1a1a1a 110deg 120deg,
    #c8a000 120deg 130deg,
    #1a1a1a 130deg 140deg,
    #c8a000 140deg 150deg,
    #1a1a1a 150deg 160deg,
    #c8a000 160deg 170deg,
    #1a1a1a 170deg 180deg,
    #c8a000 180deg 190deg,
    #1a1a1a 190deg 200deg,
    #c8a000 200deg 210deg,
    #1a1a1a 210deg 220deg,
    #c8a000 220deg 230deg,
    #1a1a1a 230deg 240deg,
    #c8a000 240deg 250deg,
    #1a1a1a 250deg 260deg,
    #c8a000 260deg 270deg,
    #1a1a1a 270deg 280deg,
    #c8a000 280deg 290deg,
    #1a1a1a 290deg 300deg,
    #c8a000 300deg 310deg,
    #1a1a1a 310deg 320deg,
    #c8a000 320deg 330deg,
    #1a1a1a 330deg 340deg,
    #c8a000 340deg 350deg,
    #1a1a1a 350deg 360deg
  );
  box-shadow: 0 0 30px rgba(200,160,0,0.3), inset 0 0 20px rgba(0,0,0,0.5);
}

.wheel-disc {
  position: absolute;
  inset: 15px;
  border-radius: 50%;
  background: #1a1a1a;
  overflow: hidden;
  box-shadow: inset 0 0 20px rgba(0,0,0,0.8);
}

.wheel-segment {
  position: absolute;
  top: 0; left: 50%;
  width: 50%;
  height: 50%;
  transform-origin: 0% 100%;
  background: var(--seg-color);
  clip-path: polygon(0% 100%, 100% 85%, 95% 0%, 0% 0%);
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 6px 8px;
}

.seg-num {
  font-size: 8px;
  font-weight: 700;
  color: white;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
  transform: rotate(90deg);
}

.wheel-center {
  position: absolute;
  inset: 30%;
  border-radius: 50%;
  background: radial-gradient(circle, #2a1a00, #1a0e00);
  border: 3px solid var(--gold);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  box-shadow: 0 0 20px rgba(246,183,86,0.4);
}

.wheel-inner-ring {
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  border: 1px solid rgba(246,183,86,0.3);
}

.wheel-logo {
  font-family: 'Playfair Display', serif;
  font-size: 20px;
  color: var(--gold);
  z-index: 1;
}

.wheel-marker {
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 24px;
  color: var(--gold);
  z-index: 20;
  text-shadow: 0 0 10px var(--gold);
}

.wheel-outer.spinning .wheel-disc {
  animation: wheelSpinFast 0.1s linear infinite;
}

@keyframes wheelSpinFast {
  to { transform: rotate(360deg); }
}

.roulette-result-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 24px;
  background: rgba(0,0,0,0.6);
  border: 2px solid var(--gold);
  border-radius: 12px;
}

.r-num {
  font-size: 48px;
  font-weight: 900;
  font-family: 'Playfair Display', serif;
  line-height: 1;
}

.num-red { color: #dc2626; text-shadow: 0 0 20px rgba(220,38,38,0.5); }
.num-black { color: #f0e6c8; }
.num-green { color: #16a34a; text-shadow: 0 0 20px rgba(22,163,74,0.5); }

.r-color { font-size: 12px; letter-spacing: 0.15em; color: rgba(240,230,200,0.5); }

.recent-numbers {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
  max-width: 360px;
}

.recent-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
}

.recent-num.num-red { background: #dc2626; color: white; }
.recent-num.num-black { background: #1c1c1c; color: white; border: 1px solid #444; }
.recent-num.num-green { background: #16a34a; color: white; }

/* Roulette right */
.roulette-right { display: flex; flex-direction: column; gap: 16px; }

.r-bet-row { display: flex; flex-direction: column; gap: 8px; }
.r-bet-label { font-size: 14px; font-weight: 600; color: var(--gold); font-family: 'JetBrains Mono', monospace; }

.r-bet-chips { display: flex; gap: 8px; flex-wrap: wrap; }

.r-chip {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 3px solid rgba(255,255,255,0.2);
  background: var(--chip-color, #dc2626);
  color: white;
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 3px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2);
}

.r-chip:hover { transform: translateY(-3px) scale(1.05); box-shadow: 0 8px 20px rgba(0,0,0,0.4); }
.r-chip:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
.r-chip-clear { background: #4b5563; }

/* Special bets */
.r-special-bets {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.r-special {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 6px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
  color: inherit;
  font-family: 'Oswald', sans-serif;
  font-size: 12px;
}

.r-special:hover { background: rgba(246,183,86,0.08); border-color: rgba(246,183,86,0.3); }
.r-special.selected { background: rgba(246,183,86,0.15); border-color: var(--gold); color: var(--gold); }
.r-special small { font-size: 10px; color: rgba(240,230,200,0.5); }
.r-special.selected small { color: rgba(246,183,86,0.7); }
.r-special:disabled { opacity: 0.4; cursor: not-allowed; }

/* Number grid */
.r-grid-wrap { display: flex; flex-direction: column; gap: 8px; }

.r-number-grid { display: flex; gap: 4px; }

.r-zero {
  width: 32px;
  background: #16a34a;
  color: white;
  border: 1px solid #22c55e;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  transition: all 0.15s;
  writing-mode: vertical-lr;
  padding: 4px 2px;
}
.r-zero.selected { box-shadow: 0 0 12px rgba(22,163,74,0.6); transform: scale(1.05); }

.r-nums {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 2px;
  flex: 1;
}

.r-num-btn {
  padding: 6px 2px;
  border-radius: 4px;
  border: 1px solid transparent;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.1s;
  text-align: center;
}

.r-num-btn.num-red { background: #7f1d1d; color: #fca5a5; border-color: #dc2626; }
.r-num-btn.num-black { background: #111; color: #d1d5db; border-color: #374151; }
.r-num-btn:hover { filter: brightness(1.4); transform: scale(1.1); }
.r-num-btn.selected { box-shadow: 0 0 10px var(--gold); transform: scale(1.12); border-color: var(--gold) !important; }
.r-num-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

/* Roulette action */
.r-action { display: flex; flex-direction: column; gap: 10px; }

.r-selection-info { font-size: 13px; color: rgba(240,230,200,0.6); }
.r-selection-info strong { color: var(--gold); }
.r-selection-info.muted { color: rgba(240,230,200,0.3); }

.r-spin-btn {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #6d1c1c, #dc2626, #991b1b);
  border: none;
  border-radius: 12px;
  font-family: 'Oswald', sans-serif;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 20px rgba(220,38,38,0.3);
}
.r-spin-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(220,38,38,0.4); }
.r-spin-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

.r-result {
  padding: 14px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  animation: resultPop 0.3s ease-out;
}
.r-win { background: rgba(246,183,86,0.15); border: 1px solid rgba(246,183,86,0.4); color: var(--gold); }
.r-loss { background: rgba(255,34,68,0.1); border: 1px solid rgba(255,34,68,0.2); color: #ff6b6b; }

@keyframes resultPop {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* ═══════════════════════════════════════════════════
   BLACKJACK
   ═══════════════════════════════════════════════════ */
.blackjack-table {
  position: relative;
  min-height: 520px;
  background: radial-gradient(ellipse at center, #1a5c30 0%, #0d3a1e 50%, #060f0a 100%);
  border: 4px solid #8b6914;
  border-radius: 50% / 30%;
  padding: 40px;
  max-width: 900px;
  margin: 0 auto;
  box-shadow:
    0 0 60px rgba(0,0,0,0.8),
    inset 0 0 80px rgba(0,0,0,0.4);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.table-felt {
  position: absolute;
  top: 30%;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  pointer-events: none;
}

.felt-logo {
  font-family: 'Playfair Display', serif;
  font-size: 22px;
  color: rgba(255,255,255,0.1);
  letter-spacing: 0.2em;
  white-space: nowrap;
}

.felt-rule {
  font-size: 11px;
  letter-spacing: 0.12em;
  color: rgba(255,255,255,0.07);
  white-space: nowrap;
}

.bj-area { display: flex; flex-direction: column; gap: 8px; z-index: 5; }
.dealer-area { align-items: flex-start; }
.player-area { align-items: flex-start; margin-top: auto; }

.bj-label {
  font-size: 13px;
  letter-spacing: 0.15em;
  color: rgba(255,255,255,0.5);
  display: flex;
  align-items: center;
  gap: 8px;
}

.bj-score {
  font-family: 'JetBrains Mono', monospace;
  font-size: 16px;
  font-weight: 700;
  color: var(--gold);
  padding: 2px 8px;
  background: rgba(0,0,0,0.4);
  border-radius: 6px;
}

.bj-score.bust { color: #ff4444; animation: bust 0.3s ease-in-out 3; }
.bj-score.blackjack { color: var(--gold); text-shadow: 0 0 15px var(--gold); }
@keyframes bust { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2); } }

.card-hand {
  display: flex;
  gap: -20px;
  position: relative;
}

/* Playing cards */
.playing-card {
  width: 80px;
  height: 110px;
  border-radius: 8px;
  position: relative;
  flex-shrink: 0;
  margin-left: -20px;
  box-shadow: 2px 4px 12px rgba(0,0,0,0.5);
  animation: cardDeal 0.3s ease-out both;
  animation-delay: calc(var(--card-i) * 0.15s);
  transition: transform 0.2s;
}

.playing-card:first-child { margin-left: 0; }
.playing-card:hover { transform: translateY(-8px) scale(1.05); z-index: 10; }

@keyframes cardDeal {
  from { transform: translateY(-60px) rotate(-5deg); opacity: 0; }
  to { transform: translateY(0) rotate(0); opacity: 1; }
}

.card-face {
  background: white;
  border: 1px solid #ddd;
}

.card-back {
  background: var(--card-back);
}

.card-back-design {
  position: absolute;
  inset: 6px;
  border-radius: 4px;
  background: repeating-linear-gradient(
    45deg,
    rgba(255,255,255,0.05) 0px,
    rgba(255,255,255,0.05) 2px,
    transparent 2px,
    transparent 8px
  );
  border: 1px solid rgba(255,255,255,0.15);
}

.card-red { color: #dc2626; }
.card-black { color: #111; }

.card-corner {
  position: absolute;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
}

.card-tl { top: 4px; left: 5px; }
.card-br { bottom: 4px; right: 5px; transform: rotate(180deg); }

.card-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 28px;
}

/* BJ Controls */
.bj-controls {
  margin-top: auto;
  z-index: 5;
}

.bj-betting { display: flex; flex-direction: column; gap: 12px; align-items: center; }
.bj-bet-label { font-size: 12px; letter-spacing: 0.15em; color: rgba(255,255,255,0.5); }

.bj-chips { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }

.bj-chip {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #dc2626, #991b1b);
  border: 3px solid rgba(255,255,255,0.2);
  color: white;
  font-weight: 700;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: 0 3px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2);
}
.bj-chip:hover { transform: translateY(-3px) scale(1.05); }
.bj-chip-clear { background: linear-gradient(135deg, #4b5563, #374151); }

.bj-current-bet { font-family: 'JetBrains Mono', monospace; font-size: 18px; color: var(--gold); }

.bj-deal-btn {
  padding: 14px 40px;
  background: linear-gradient(135deg, var(--gold-dark), var(--gold), var(--gold-light));
  border: none;
  border-radius: 12px;
  font-family: 'Oswald', sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: #1a0e00;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 0.1em;
}
.bj-deal-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.bj-actions { display: flex; gap: 10px; justify-content: center; }

.bj-btn {
  padding: 14px 28px;
  border: none;
  border-radius: 10px;
  font-family: 'Oswald', sans-serif;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.2s;
}

.bj-hit { background: #16a34a; color: white; box-shadow: 0 4px 15px rgba(22,163,74,0.3); }
.bj-hit:hover { background: #15803d; transform: translateY(-2px); }
.bj-stand { background: #dc2626; color: white; box-shadow: 0 4px 15px rgba(220,38,38,0.3); }
.bj-stand:hover { background: #b91c1c; transform: translateY(-2px); }
.bj-double { background: var(--gold-dark); color: white; box-shadow: 0 4px 15px rgba(200,134,14,0.3); }
.bj-double:hover { background: #a16207; transform: translateY(-2px); }
.bj-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

.bj-result-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  border-radius: 14px;
  animation: resultPop 0.4s ease-out;
}

.bj-win { background: rgba(22,163,74,0.2); border: 2px solid #16a34a; }
.bj-lose { background: rgba(220,38,38,0.15); border: 2px solid #dc2626; }
.bj-push { background: rgba(246,183,86,0.1); border: 2px solid var(--gold); }
.bj-blackjack { background: rgba(246,183,86,0.2); border: 2px solid var(--gold); box-shadow: 0 0 30px rgba(246,183,86,0.3); }

.bj-result-text { font-size: 18px; font-weight: 700; }
.bj-result-amount { font-family: 'JetBrains Mono', monospace; font-size: 28px; color: var(--gold); font-weight: 700; }

.bj-new-game {
  padding: 10px 28px;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 8px;
  font-family: 'Oswald', sans-serif;
  font-size: 14px;
  letter-spacing: 0.1em;
  color: inherit;
  cursor: pointer;
  transition: all 0.2s;
}
.bj-new-game:hover { background: rgba(255,255,255,0.15); }

/* ═══════════════════════════════════════════════════
   FORTUNE WHEEL
   ═══════════════════════════════════════════════════ */
.wof-container { display: flex; flex-direction: column; gap: 24px; align-items: center; }

.wof-wheel-selector { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }

.wof-select-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 20px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  cursor: pointer;
  color: inherit;
  font-family: 'Oswald', sans-serif;
  transition: all 0.2s;
  min-width: 140px;
}

.wof-select-btn:hover { border-color: rgba(246,183,86,0.3); background: rgba(246,183,86,0.05); }
.wof-select-btn.active { border-color: var(--gold); background: rgba(246,183,86,0.1); }
.wof-select-btn.insufficient { opacity: 0.4; }

.wsb-name { font-size: 14px; font-weight: 600; }
.wsb-cost { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--gold); }
.wsb-cd { font-size: 11px; color: #f97316; }

/* Fortune Wheel */
.fortune-wheel-wrap { display: flex; flex-direction: column; align-items: center; gap: 16px; max-width: 500px; width: 100%; }

.fw-title {
  font-family: 'Playfair Display', serif;
  font-size: 24px;
  color: var(--gold);
  text-shadow: 0 0 20px rgba(246,183,86,0.4);
}

.fortune-wheel-outer {
  position: relative;
  width: 320px;
  height: 320px;
}

.fw-pointer {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 20px;
  color: var(--gold);
  z-index: 20;
  text-shadow: 0 0 10px var(--gold);
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));
}

.fortune-wheel {
  width: 320px;
  height: 320px;
  border-radius: 50%;
  position: relative;
  overflow: hidden;
  border: 6px solid var(--gold);
  box-shadow: 0 0 40px rgba(246,183,86,0.3), inset 0 0 30px rgba(0,0,0,0.5);
}

.fw-segment {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform-origin: center;
  overflow: hidden;
}

.fw-segment::before {
  content: '';
  position: absolute;
  top: 0; left: 50%;
  width: 50%;
  height: 50%;
  background: var(--seg-color);
  transform-origin: 0% 100%;
  transform: rotate(calc(var(--seg-angle) / 2));
  clip-path: polygon(0% 100%, 100% 50%, 100% 0%, 0% 50%);
}

.fw-seg-content {
  position: absolute;
  top: 0; left: 50%;
  transform-origin: 0% 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.fw-seg-icon { font-size: 14px; }
.fw-seg-label { font-size: 8px; font-weight: 700; color: white; text-shadow: 0 1px 3px rgba(0,0,0,0.8); white-space: nowrap; }

.fw-center-hub {
  position: absolute;
  inset: 42%;
  border-radius: 50%;
  background: radial-gradient(circle, #2a1a00, #1a0e00);
  border: 3px solid var(--gold);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  font-size: 20px;
  color: var(--gold);
}

.fw-spin-area { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%; }

.fw-cost-info { font-size: 13px; color: rgba(240,230,200,0.6); }
.fw-cd-info { font-size: 13px; color: #f97316; }

.fw-spin-btn {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #7c1a7c, #a855f7, #7c3aed);
  border: none;
  border-radius: 12px;
  font-family: 'Oswald', sans-serif;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 20px rgba(168,85,247,0.3);
}
.fw-spin-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(168,85,247,0.4); }
.fw-spin-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

.fw-result {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border-radius: 12px;
  width: 100%;
  animation: resultPop 0.3s ease-out;
}

.fw-win { background: rgba(246,183,86,0.15); border: 1px solid rgba(246,183,86,0.4); }
.fw-loss { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); }

.fw-r-icon { font-size: 28px; }
.fw-r-text { display: flex; flex-direction: column; }
.fw-r-text strong { font-size: 16px; color: var(--gold); }
.fw-r-text span { font-size: 13px; color: rgba(240,230,200,0.6); }

.fw-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  width: 100%;
}

.fw-legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: rgba(240,230,200,0.6); }
.fw-legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

/* ═══════════════════════════════════════════════════
   DICE GAME
   ═══════════════════════════════════════════════════ */
.dice-game {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  max-width: 900px;
  margin: 0 auto;
  align-items: start;
}

.dice-arena {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.dice-table-felt {
  background: radial-gradient(ellipse, #1a3a5c, #0d1f30);
  border: 3px solid #1e4d78;
  border-radius: 20px;
  padding: 32px 48px;
  text-align: center;
  width: 100%;
}

.dice-title {
  font-family: 'Playfair Display', serif;
  font-size: 22px;
  color: rgba(255,255,255,0.15);
  letter-spacing: 0.25em;
}

.dice-container { display: flex; gap: 24px; }

.die {
  width: 90px;
  height: 90px;
  border-radius: 16px;
  background: white;
  border: 2px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 20px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.5);
  transition: transform 0.1s;
}

.die.rolling {
  animation: dieRoll 0.15s linear infinite;
}

@keyframes dieRoll {
  0% { transform: rotate(0deg); }
  25% { transform: rotate(5deg) scale(1.02); }
  50% { transform: rotate(-3deg); }
  75% { transform: rotate(4deg) scale(0.98); }
  100% { transform: rotate(0deg); }
}

.die-face { width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; }

.die-dots {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  width: 70px;
  height: 70px;
  padding: 8px;
  gap: 0;
}

.dot {
  width: 10px;
  height: 10px;
  background: #1a1a1a;
  border-radius: 50%;
  margin: auto;
}

.die-1 .die-dots { grid-template-areas: ". . ." ". d ." ". . ."; }
.die-1 .dot:nth-child(1) { grid-area: d; }

.die-rolling-icon { font-size: 40px; color: #333; animation: spinFast 0.2s linear infinite; }
@keyframes spinFast { to { transform: rotate(360deg); } }

.dice-sum {
  font-family: 'Playfair Display', serif;
  font-size: 28px;
  color: var(--gold);
  text-shadow: 0 0 15px rgba(246,183,86,0.4);
}

/* Dice panel */
.dice-bets-panel { display: flex; flex-direction: column; gap: 16px; }

.dice-bet-amount { display: flex; flex-direction: column; gap: 8px; }
.dice-bet-amount > span { font-family: 'JetBrains Mono', monospace; font-size: 16px; color: var(--gold); }

.dice-chips-row { display: flex; gap: 6px; flex-wrap: wrap; }

.dice-chip {
  padding: 6px 12px;
  background: rgba(246,183,86,0.1);
  border: 1px solid rgba(246,183,86,0.2);
  border-radius: 8px;
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  color: rgba(240,230,200,0.7);
  cursor: pointer;
  transition: all 0.15s;
}
.dice-chip:hover { background: rgba(246,183,86,0.2); color: var(--gold); }
.dice-chip:disabled { opacity: 0.4; cursor: not-allowed; }
.dice-clear { color: #ff6b6b; border-color: rgba(255,107,107,0.2); background: rgba(255,107,107,0.05); }

.dice-predictions { display: flex; flex-direction: column; gap: 10px; }

.dp-group { display: flex; flex-direction: column; gap: 6px; }

.dp-label {
  font-size: 9px;
  letter-spacing: 0.15em;
  color: rgba(240,230,200,0.4);
}

.dp-btns { display: flex; gap: 4px; flex-wrap: wrap; }

.dp-btn {
  padding: 8px 10px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(240,230,200,0.7);
  cursor: pointer;
  transition: all 0.15s;
  min-width: 36px;
  text-align: center;
}
.dp-btn:hover { background: rgba(246,183,86,0.08); border-color: rgba(246,183,86,0.3); color: var(--gold); }
.dp-btn.selected { background: rgba(246,183,86,0.15); border-color: var(--gold); color: var(--gold); }
.dp-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.dp-wide { flex: 1; min-width: 80px; }

.dice-roll-btn {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #1e3a5f, #2563eb, #1d4ed8);
  border: none;
  border-radius: 12px;
  font-family: 'Oswald', sans-serif;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 20px rgba(37,99,235,0.3);
}
.dice-roll-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(37,99,235,0.4); }
.dice-roll-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

.dice-result {
  padding: 14px;
  border-radius: 10px;
  font-size: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  animation: resultPop 0.3s ease-out;
}
.dice-win { background: rgba(22,163,74,0.15); border: 1px solid rgba(22,163,74,0.4); color: #4ade80; }
.dice-loss { background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.2); color: #f87171; }
.dice-result strong { font-family: 'JetBrains Mono', monospace; font-size: 18px; }

.dice-history { display: flex; flex-direction: column; gap: 4px; }

.dh-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}
.dh-win { background: rgba(22,163,74,0.1); color: #4ade80; }
.dh-loss { background: rgba(220,38,38,0.07); color: #f87171; }

/* ═══════════════════════════════════════════════════
   COIN FLIP
   ═══════════════════════════════════════════════════ */
.coinflip-game {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  max-width: 800px;
  margin: 0 auto;
  align-items: center;
}

.coin-arena {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  perspective: 600px;
}

.coin-container {
  width: 180px;
  height: 180px;
  perspective: 1200px;
}

.coin {
  width: 180px;
  height: 180px;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.1s;
  border-radius: 50%;
  filter: drop-shadow(0 10px 30px rgba(0,0,0,0.6));
}

.coin.flipping {
  animation: coinFlip 2s ease-in-out forwards;
}

.coin.landed-heads { transform: rotateY(0deg); }
.coin.landed-tails { transform: rotateY(180deg); }

@keyframes coinFlip {
  0% { transform: rotateY(0deg) translateY(0); }
  20% { transform: rotateY(360deg) translateY(-40px); }
  40% { transform: rotateY(720deg) translateY(-60px); }
  60% { transform: rotateY(1080deg) translateY(-40px); }
  80% { transform: rotateY(1440deg) translateY(-20px); }
  100% { transform: rotateY(1800deg) translateY(0); }
}

.coin-face {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  backface-visibility: hidden;
}

.coin-heads {
  background: radial-gradient(circle at 35% 35%, #ffd980, #f6b756, #c8860e);
  border: 4px solid rgba(255,255,255,0.2);
  box-shadow: inset 0 -4px 8px rgba(0,0,0,0.2), inset 0 4px 8px rgba(255,255,255,0.3);
}

.coin-tails {
  background: radial-gradient(circle at 35% 35%, #d1d5db, #9ca3af, #6b7280);
  border: 4px solid rgba(255,255,255,0.2);
  box-shadow: inset 0 -4px 8px rgba(0,0,0,0.2), inset 0 4px 8px rgba(255,255,255,0.3);
  transform: rotateY(180deg);
}

.coin-symbol { font-size: 48px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
.coin-text { font-size: 10px; letter-spacing: 0.2em; font-weight: 700; color: rgba(0,0,0,0.5); }

.coin-shadow {
  width: 120px;
  height: 16px;
  background: radial-gradient(ellipse, rgba(0,0,0,0.5), transparent);
  border-radius: 50%;
  filter: blur(4px);
}

/* Coin flip panel */
.coinflip-panel { display: flex; flex-direction: column; gap: 16px; }

.cf-title {
  font-family: 'Playfair Display', serif;
  font-size: 28px;
  color: var(--gold);
}

.cf-subtitle { font-size: 14px; color: rgba(240,230,200,0.5); }

.cf-bet-row { display: flex; flex-direction: column; gap: 8px; }
.cf-bet-label { font-family: 'JetBrains Mono', monospace; font-size: 16px; color: var(--gold); }

.cf-chips { display: flex; gap: 6px; flex-wrap: wrap; }

.cf-chip {
  padding: 6px 12px;
  background: rgba(246,183,86,0.1);
  border: 1px solid rgba(246,183,86,0.2);
  border-radius: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: rgba(240,230,200,0.7);
  cursor: pointer;
  transition: all 0.15s;
}
.cf-chip:hover { background: rgba(246,183,86,0.2); color: var(--gold); }
.cf-chip:disabled { opacity: 0.4; cursor: not-allowed; }
.cf-clear { color: #ff6b6b; }

.cf-choice { display: flex; align-items: center; gap: 16px; }

.cf-side {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 20px;
  background: rgba(255,255,255,0.03);
  border: 2px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  cursor: pointer;
  color: inherit;
  font-family: 'Oswald', sans-serif;
  transition: all 0.2s;
}

.cf-side:hover { background: rgba(246,183,86,0.05); border-color: rgba(246,183,86,0.2); }
.cf-side.selected { background: rgba(246,183,86,0.12); border-color: var(--gold); box-shadow: 0 0 20px rgba(246,183,86,0.15); }
.cf-side:disabled { opacity: 0.4; cursor: not-allowed; }

.cf-icon { font-size: 36px; }
.cf-side span { font-size: 14px; font-weight: 600; letter-spacing: 0.1em; }
.cf-side small { font-size: 11px; color: rgba(240,230,200,0.4); }

.cf-or { font-size: 18px; color: rgba(240,230,200,0.3); font-weight: 700; }

.cf-flip-btn {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #854d0e, #d97706, #f59e0b);
  border: none;
  border-radius: 12px;
  font-family: 'Oswald', sans-serif;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 20px rgba(217,119,6,0.3);
}
.cf-flip-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(217,119,6,0.4); }
.cf-flip-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

.cf-result {
  padding: 16px;
  border-radius: 12px;
  text-align: center;
  animation: resultPop 0.3s ease-out;
}
.cf-win { background: rgba(246,183,86,0.15); border: 2px solid var(--gold); }
.cf-loss { background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.2); }
.cf-r-label { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
.cf-r-amount { font-family: 'JetBrains Mono', monospace; font-size: 24px; color: var(--gold); font-weight: 700; }
.cf-r-msg { font-size: 13px; color: rgba(240,230,200,0.6); margin-top: 4px; }

.cf-streak {
  font-size: 14px;
  color: #f97316;
  text-align: center;
}
.cf-streak strong { font-size: 20px; }

.cf-history { display: flex; gap: 6px; flex-wrap: wrap; }
.ch-dot {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  border: 2px solid transparent;
}
.ch-win { background: rgba(246,183,86,0.2); border-color: rgba(246,183,86,0.4); }
.ch-loss { background: rgba(220,38,38,0.1); border-color: rgba(220,38,38,0.2); }

/* ═══════════════════════════════════════════════════
   BIG WIN NOTIFICATION
   ═══════════════════════════════════════════════════ */
.big-win-notif {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
  text-align: center;
  pointer-events: none;
}

.bwn-content {
  background: linear-gradient(135deg, rgba(0,0,0,0.95), rgba(26,14,0,0.98));
  border: 3px solid var(--gold);
  border-radius: 20px;
  padding: 28px 48px;
  box-shadow: 0 0 60px rgba(246,183,86,0.4), 0 0 120px rgba(246,183,86,0.2);
}

.bwn-label {
  font-family: 'Playfair Display', serif;
  font-size: 24px;
  letter-spacing: 0.3em;
  color: var(--gold);
  text-transform: uppercase;
}

.bwn-amount {
  font-family: 'JetBrains Mono', monospace;
  font-size: 48px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--gold-dark), var(--gold-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: none;
}

.bwn-confetti {
  position: absolute;
  inset: -60px;
  pointer-events: none;
}

.confetti-piece {
  position: absolute;
  font-size: 24px;
  animation: confettiFly 2s ease-out both;
  animation-delay: calc(var(--i) * 0.1s);
  top: 50%;
  left: 50%;
}

@keyframes confettiFly {
  0% { transform: translate(-50%, -50%) rotate(0deg) scale(0); opacity: 1; }
  100% { transform: translate(calc(-50% + calc(var(--i) * 22px - 130px)), calc(-50% + calc(var(--i) * 18px - 100px))) rotate(calc(var(--i) * 60deg)) scale(1.5); opacity: 0; }
}

/* Transitions */
.win-notif-enter-active { animation: bigWinEnter 0.4s ease-out; }
.win-notif-leave-active { animation: bigWinLeave 0.4s ease-in; }
@keyframes bigWinEnter {
  from { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
  70% { transform: translate(-50%, -50%) scale(1.05); opacity: 1; }
  to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}
@keyframes bigWinLeave {
  from { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  to { transform: translate(-50%, -50%) scale(1.1); opacity: 0; }
}

/* ═══════════════════════════════════════════════════
   RESPONSIVE
   ═══════════════════════════════════════════════════ */
@media (max-width: 900px) {
  .roulette-layout { grid-template-columns: 1fr; }
  .wheel-outer { width: 280px; height: 280px; }
  .dice-game { grid-template-columns: 1fr; }
  .coinflip-game { grid-template-columns: 1fr; }
}

@media (max-width: 600px) {
  .header-main { padding: 12px 16px; }
  .logo-main { font-size: 20px; }
  .machine-body { padding: 18px; }
  .blackjack-table { border-radius: 20px; padding: 20px; }
  .slot-controls { flex-direction: column; }
}
</style>