import os

def generate_remaining():
    # -------------------------------------------------------------------------
    # 04_FLOW_TRADE_NEGOTIATION.svg
    # -------------------------------------------------------------------------
    svg_04 = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" width="1440" height="900" style="background:#03111e; font-family:'Rubik', system-ui, sans-serif;">
  <defs>
    <filter id="modal-shadow"><feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000" flood-opacity="0.75"/></filter>
    <filter id="shadow-sm"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.4"/></filter>
    <filter id="glow-orange"><feGaussianBlur stdDeviation="8" result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>

    <linearGradient id="modal-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0f3d69"/><stop offset="100%" stop-color="#072644"/></linearGradient>
    <linearGradient id="card-inner" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#061c33"/><stop offset="100%" stop-color="#031120"/></linearGradient>
  </defs>

  <!-- Dimmed Background Board Preview (Behind Modal Overlay) -->
  <g opacity="0.35">
    <rect width="1440" height="900" fill="#041a2e"/>
    <circle cx="720" cy="450" r="280" fill="#0f3d69" opacity="0.2"/>
  </g>

  <!-- Title Indicator -->
  <g transform="translate(60, 45)">
    <text font-family="'Bricolage Grotesque', sans-serif" font-size="28" font-weight="bold" fill="#ffffff">FLOW 6: TRADE NEGOTIATION DOCK</text>
    <text font-size="14" fill="#60a5fa" y="24">Interactive Negotiation Modal • Bank/Maritime Harbor Rates &amp; Player-to-Player Offers with Live Counter-Proposals</text>
  </g>

  <!-- CENTER TRADE MODAL (Width: 680px, Height: 710px) -->
  <g id="Trade-Modal-Window" transform="translate(380, 110)" filter="url(#modal-shadow)">
    <!-- Main Modal Surface -->
    <rect width="680" height="710" rx="18" fill="url(#modal-bg)" stroke="#1d64a6" stroke-width="2"/>

    <!-- Modal Header -->
    <g transform="translate(32, 36)">
      <text font-family="'Bricolage Grotesque', sans-serif" font-size="24" font-weight="bold" fill="#ffffff">Trade Exchange</text>
      <text y="22" font-size="13" fill="#8cb3d9">Propose a trade to the table or barter directly with maritime harbors.</text>
      <!-- Close Button (Top Right) -->
      <g transform="translate(585, -12)">
        <circle cx="16" cy="16" r="16" fill="#041527" stroke="#1d4d7a"/>
        <text x="16" y="22" font-size="16" fill="#cbd5e1" text-anchor="middle">✕</text>
      </g>
    </g>

    <!-- Tab Selector (Bank vs Players) -->
    <g transform="translate(32, 85)">
      <rect width="616" height="46" rx="10" fill="#04182a"/>
      <!-- Bank Tab (Inactive) -->
      <g transform="translate(4, 4)">
        <rect width="300" height="38" rx="8" fill="transparent"/>
        <text x="150" y="24" font-size="14" font-weight="bold" fill="#7fa6c9" text-anchor="middle">⚓ Maritime &amp; Harbors (2:1 / 3:1 / 4:1)</text>
      </g>
      <!-- Player Trade Tab (Active) -->
      <g transform="translate(308, 4)">
        <rect width="304" height="38" rx="8" fill="#1062b0" stroke="#38bdf8" stroke-width="1.5"/>
        <text x="152" y="24" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle">👥 Player-to-Player Trade</text>
      </g>
    </g>

    <!-- PROPOSE AN OFFER DOCK (Give vs Receive Columns) -->
    <g transform="translate(32, 150)">
      <rect width="616" height="235" rx="12" fill="url(#card-inner)" stroke="#163f66" stroke-width="1.5"/>
      <text x="24" y="28" font-size="14" font-weight="bold" fill="#ffd54f">BUILD YOUR PROPOSAL</text>

      <!-- Left Column: You Give (with hand limits) -->
      <g transform="translate(24, 45)">
        <text font-size="12" font-weight="bold" fill="#f87171">YOU GIVE</text>
        
        <!-- Wood Stepper -->
        <g transform="translate(0, 15)">
          <text font-size="20">🪵</text>
          <text x="32" y="16" font-size="13" fill="#cbd5e1">Wood (have 2)</text>
          <g transform="translate(180, 0)">
            <rect width="24" height="24" rx="4" fill="#0f3d69"/><text x="12" y="16" font-size="14" font-weight="bold" fill="#fff" text-anchor="middle">−</text>
            <text x="44" y="17" font-size="15" font-weight="bold" fill="#ffd54f" text-anchor="middle">1</text>
            <rect x="62" y="0" width="24" height="24" rx="4" fill="#0f3d69"/><text x="74" y="17" font-size="14" font-weight="bold" fill="#fff" text-anchor="middle">+</text>
          </g>
        </g>
        <!-- Brick Stepper -->
        <g transform="translate(0, 50)">
          <text font-size="20">🧱</text>
          <text x="32" y="16" font-size="13" fill="#cbd5e1">Brick (have 1)</text>
          <g transform="translate(180, 0)">
            <rect width="24" height="24" rx="4" fill="#0f3d69"/><text x="12" y="16" font-size="14" font-weight="bold" fill="#fff" text-anchor="middle">−</text>
            <text x="44" y="17" font-size="15" font-weight="bold" fill="#cbd5e1" text-anchor="middle">0</text>
            <rect x="62" y="0" width="24" height="24" rx="4" fill="#0f3d69"/><text x="74" y="17" font-size="14" font-weight="bold" fill="#fff" text-anchor="middle">+</text>
          </g>
        </g>
        <!-- Ore Stepper -->
        <g transform="translate(0, 85)">
          <text font-size="20">⛰</text>
          <text x="32" y="16" font-size="13" fill="#cbd5e1">Ore (have 1)</text>
          <g transform="translate(180, 0)">
            <rect width="24" height="24" rx="4" fill="#0f3d69"/><text x="12" y="16" font-size="14" font-weight="bold" fill="#fff" text-anchor="middle">−</text>
            <text x="44" y="17" font-size="15" font-weight="bold" fill="#cbd5e1" text-anchor="middle">0</text>
            <rect x="62" y="0" width="24" height="24" rx="4" fill="#0f3d69"/><text x="74" y="17" font-size="14" font-weight="bold" fill="#fff" text-anchor="middle">+</text>
          </g>
        </g>
      </g>

      <!-- Center Divider Arrow -->
      <g transform="translate(308, 115)">
        <circle cx="0" cy="0" r="18" fill="#f06800" filter="url(#shadow-sm)"/>
        <text x="0" y="6" font-size="16" font-weight="bold" fill="#fff" text-anchor="middle">➔</text>
      </g>

      <!-- Right Column: You Receive -->
      <g transform="translate(340, 45)">
        <text font-size="12" font-weight="bold" fill="#4ade80">YOU RECEIVE</text>

        <!-- Wheat Stepper -->
        <g transform="translate(0, 15)">
          <text font-size="20">🌾</text>
          <text x="32" y="16" font-size="13" fill="#cbd5e1">Wheat</text>
          <g transform="translate(160, 0)">
            <rect width="24" height="24" rx="4" fill="#0f3d69"/><text x="12" y="16" font-size="14" font-weight="bold" fill="#fff" text-anchor="middle">−</text>
            <text x="44" y="17" font-size="15" font-weight="bold" fill="#ffd54f" text-anchor="middle">1</text>
            <rect x="62" y="0" width="24" height="24" rx="4" fill="#0f3d69"/><text x="74" y="17" font-size="14" font-weight="bold" fill="#fff" text-anchor="middle">+</text>
          </g>
        </g>
        <!-- Sheep Stepper -->
        <g transform="translate(0, 50)">
          <text font-size="20">🐑</text>
          <text x="32" y="16" font-size="13" fill="#cbd5e1">Sheep</text>
          <g transform="translate(160, 0)">
            <rect width="24" height="24" rx="4" fill="#0f3d69"/><text x="12" y="16" font-size="14" font-weight="bold" fill="#fff" text-anchor="middle">−</text>
            <text x="44" y="17" font-size="15" font-weight="bold" fill="#cbd5e1" text-anchor="middle">0</text>
            <rect x="62" y="0" width="24" height="24" rx="4" fill="#0f3d69"/><text x="74" y="17" font-size="14" font-weight="bold" fill="#fff" text-anchor="middle">+</text>
          </g>
        </g>
      </g>

      <!-- Broadcast Offer CTA Button -->
      <g transform="translate(24, 180)">
        <rect width="568" height="42" rx="8" fill="#f06800" filter="url(#glow-orange)"/>
        <text x="284" y="26" font-family="'Bricolage Grotesque', sans-serif" font-size="15" font-weight="bold" fill="#ffffff" text-anchor="middle">Broadcast Offer: Give 🪵1 ➜ Receive 🌾1</text>
      </g>
    </g>

    <!-- LIVE OPEN OFFERS & COUNTER-OFFERS TRAY -->
    <g transform="translate(32, 400)">
      <text x="0" y="0" font-size="14" font-weight="bold" fill="#ffd54f">LIVE TABLE OFFERS &amp; COUNTER-PROPOSALS (3)</text>

      <!-- Offer Card 1: Alice's Counter-Proposal -->
      <g transform="translate(0, 15)" filter="url(#shadow-sm)">
        <rect width="616" height="72" rx="10" fill="#051f38" stroke="#ff4d4d" stroke-width="2"/>
        <circle cx="28" cy="36" r="14" fill="#ff4d4d"/>
        <text x="52" y="32" font-size="14" font-weight="bold" fill="#fff">Alice countered:</text>
        <text x="52" y="50" font-size="12" fill="#93c5fd">Offers 🪵1 🧱1 for your 🌾2</text>

        <!-- Response Action Buttons (Right) -->
        <g transform="translate(420, 18)">
          <rect width="85" height="36" rx="6" fill="#15803d"/>
          <text x="42" y="23" font-size="12" font-weight="bold" fill="#fff" text-anchor="middle">Accept ✓</text>

          <rect x="95" width="85" height="36" rx="6" fill="#7f1d1d"/>
          <text x="137" y="23" font-size="12" font-weight="bold" fill="#fca5a5" text-anchor="middle">Decline ✕</text>
        </g>
      </g>

      <!-- Offer Card 2: Carol's Direct Offer -->
      <g transform="translate(0, 100)" filter="url(#shadow-sm)">
        <rect width="616" height="72" rx="10" fill="#061c33" stroke="#ea580c" stroke-width="1.5"/>
        <circle cx="28" cy="36" r="14" fill="#ea580c"/>
        <text x="52" y="32" font-size="14" font-weight="bold" fill="#fff">Carol offers:</text>
        <text x="52" y="50" font-size="12" fill="#fdba74">Offers 🐑2 for anyone's ⛰1 Ore</text>

        <g transform="translate(360, 18)">
          <rect width="75" height="36" rx="6" fill="#0284c7"/>
          <text x="37" y="23" font-size="12" font-weight="bold" fill="#fff" text-anchor="middle">Counter</text>

          <rect x="85" width="75" height="36" rx="6" fill="#15803d"/>
          <text x="122" y="23" font-size="12" font-weight="bold" fill="#fff" text-anchor="middle">Accept</text>

          <rect x="170" width="75" height="36" rx="6" fill="#334155"/>
          <text x="207" y="23" font-size="12" fill="#94a3b8" text-anchor="middle">Pass</text>
        </g>
      </g>

      <!-- Offer Card 3: Your own open offer -->
      <g transform="translate(0, 185)">
        <rect width="616" height="55" rx="10" fill="#041629" stroke="#1d4d7a" stroke-width="1.5"/>
        <text x="24" y="32" font-size="13" font-weight="bold" fill="#38bdf8">Your Open Offer: 🪵1 ➜ 🌾1</text>
        <text x="380" y="32" font-size="11" fill="#7fa6c9">Waiting for table responses…</text>
        <rect x="520" y="12" width="76" height="32" rx="6" fill="#dc2626"/>
        <text x="558" y="32" font-size="11" font-weight="bold" fill="#fff" text-anchor="middle">Cancel</text>
      </g>
    </g>
  </g>
</svg>'''

    # -------------------------------------------------------------------------
    # 05_FLOW_ROBBER_AND_DISCARD.svg
    # -------------------------------------------------------------------------
    svg_05 = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" width="1440" height="900" style="background:#03111e; font-family:'Rubik', system-ui, sans-serif;">
  <defs>
    <filter id="modal-shadow"><feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000" flood-opacity="0.8"/></filter>
    <filter id="shadow-md"><feDropShadow dx="0" dy="5" stdDeviation="8" flood-color="#000" flood-opacity="0.5"/></filter>
    <filter id="glow-red"><feGaussianBlur stdDeviation="8" result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>

    <linearGradient id="modal-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0f3d69"/><stop offset="100%" stop-color="#072644"/></linearGradient>
    <linearGradient id="danger-bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ef4444"/><stop offset="100%" stop-color="#991b1b"/></linearGradient>
  </defs>

  <rect width="1440" height="900" fill="#041a2e"/>

  <!-- Title Indicator -->
  <g transform="translate(60, 40)">
    <text font-family="'Bricolage Grotesque', sans-serif" font-size="28" font-weight="bold" fill="#ffffff">FLOW 7: THE ROBBER EVENT &amp; DISCARD HALF</text>
    <text font-size="14" fill="#f87171" y="24">Rolling 7 Event Flow • Simultaneous Discard Half Modal • 3D Pawn Relocation &amp; Circular Victim Steal Wheel</text>
  </g>

  <!-- SPLIT VIEW: SCREEN A (DISCARD MODAL) & SCREEN B (VICTIM STEAL WHEEL) -->
  
  <!-- LEFT: SCREEN A — DISCARD HALF MODAL (For players with 8+ cards) -->
  <g id="Screen-A-Discard-Modal" transform="translate(60, 110)" filter="url(#modal-shadow)">
    <rect width="620" height="710" rx="18" fill="url(#modal-bg)" stroke="#ef4444" stroke-width="2"/>
    <!-- Top Alert Banner -->
    <rect width="620" height="54" rx="18" fill="url(#danger-bar)"/>
    <text x="310" y="34" font-family="'Bricolage Grotesque', sans-serif" font-size="18" font-weight="bold" fill="#fff" text-anchor="middle">🚨 A 7 WAS ROLLED — THE ROBBER ATTACKS!</text>

    <!-- Modal Content -->
    <g transform="translate(32, 80)">
      <text font-family="'Bricolage Grotesque', sans-serif" font-size="22" font-weight="bold" fill="#ffffff">Discard 4 Cards</text>
      <text y="24" font-size="13" fill="#cbd5e1">You hold 9 resource cards. The rules require discarding half (4 cards, rounded down).</text>
      
      <!-- Steppers for Hand -->
      <g transform="translate(0, 50)">
        <!-- Wood (Have 3, select 2) -->
        <g transform="translate(0, 0)">
          <rect width="556" height="54" rx="8" fill="#051c33" stroke="#1e4e7a"/>
          <text x="18" y="34" font-size="22">🪵</text>
          <text x="52" y="32" font-size="14" font-weight="bold" fill="#fff">Lumber (Wood)</text>
          <text x="165" y="32" font-size="12" fill="#7fa6c9">In hand: 3</text>
          <g transform="translate(420, 12)">
            <rect width="30" height="30" rx="6" fill="#0f3d69"/><text x="15" y="21" font-size="16" font-weight="bold" fill="#fff" text-anchor="middle">−</text>
            <text x="55" y="21" font-size="17" font-weight="bold" fill="#ffd54f" text-anchor="middle">2</text>
            <rect x="75" width="30" height="30" rx="6" fill="#0f3d69"/><text x="90" y="21" font-size="16" font-weight="bold" fill="#fff" text-anchor="middle">+</text>
          </g>
        </g>

        <!-- Brick (Have 2, select 1) -->
        <g transform="translate(0, 64)">
          <rect width="556" height="54" rx="8" fill="#051c33" stroke="#1e4e7a"/>
          <text x="18" y="34" font-size="22">🧱</text>
          <text x="52" y="32" font-size="14" font-weight="bold" fill="#fff">Brick</text>
          <text x="165" y="32" font-size="12" fill="#7fa6c9">In hand: 2</text>
          <g transform="translate(420, 12)">
            <rect width="30" height="30" rx="6" fill="#0f3d69"/><text x="15" y="21" font-size="16" font-weight="bold" fill="#fff" text-anchor="middle">−</text>
            <text x="55" y="21" font-size="17" font-weight="bold" fill="#ffd54f" text-anchor="middle">1</text>
            <rect x="75" width="30" height="30" rx="6" fill="#0f3d69"/><text x="90" y="21" font-size="16" font-weight="bold" fill="#fff" text-anchor="middle">+</text>
          </g>
        </g>

        <!-- Sheep (Have 2, select 1) -->
        <g transform="translate(0, 128)">
          <rect width="556" height="54" rx="8" fill="#051c33" stroke="#1e4e7a"/>
          <text x="18" y="34" font-size="22">🐑</text>
          <text x="52" y="32" font-size="14" font-weight="bold" fill="#fff">Wool (Sheep)</text>
          <text x="165" y="32" font-size="12" fill="#7fa6c9">In hand: 2</text>
          <g transform="translate(420, 12)">
            <rect width="30" height="30" rx="6" fill="#0f3d69"/><text x="15" y="21" font-size="16" font-weight="bold" fill="#fff" text-anchor="middle">−</text>
            <text x="55" y="21" font-size="17" font-weight="bold" fill="#ffd54f" text-anchor="middle">1</text>
            <rect x="75" width="30" height="30" rx="6" fill="#0f3d69"/><text x="90" y="21" font-size="16" font-weight="bold" fill="#fff" text-anchor="middle">+</text>
          </g>
        </g>

        <!-- Wheat (Have 1, select 0) -->
        <g transform="translate(0, 192)">
          <rect width="556" height="54" rx="8" fill="#051c33" stroke="#1e4e7a"/>
          <text x="18" y="34" font-size="22">🌾</text>
          <text x="52" y="32" font-size="14" font-weight="bold" fill="#fff">Grain (Wheat)</text>
          <text x="165" y="32" font-size="12" fill="#7fa6c9">In hand: 1</text>
          <g transform="translate(420, 12)">
            <rect width="30" height="30" rx="6" fill="#0f3d69"/><text x="15" y="21" font-size="16" font-weight="bold" fill="#fff" text-anchor="middle">−</text>
            <text x="55" y="21" font-size="17" font-weight="bold" fill="#94a3b8" text-anchor="middle">0</text>
            <rect x="75" width="30" height="30" rx="6" fill="#0f3d69"/><text x="90" y="21" font-size="16" font-weight="bold" fill="#fff" text-anchor="middle">+</text>
          </g>
        </g>

        <!-- Ore (Have 1, select 0) -->
        <g transform="translate(0, 256)">
          <rect width="556" height="54" rx="8" fill="#051c33" stroke="#1e4e7a"/>
          <text x="18" y="34" font-size="22">⛰</text>
          <text x="52" y="32" font-size="14" font-weight="bold" fill="#fff">Ore</text>
          <text x="165" y="32" font-size="12" fill="#7fa6c9">In hand: 1</text>
          <g transform="translate(420, 12)">
            <rect width="30" height="30" rx="6" fill="#0f3d69"/><text x="15" y="21" font-size="16" font-weight="bold" fill="#fff" text-anchor="middle">−</text>
            <text x="55" y="21" font-size="17" font-weight="bold" fill="#94a3b8" text-anchor="middle">0</text>
            <rect x="75" width="30" height="30" rx="6" fill="#0f3d69"/><text x="90" y="21" font-size="16" font-weight="bold" fill="#fff" text-anchor="middle">+</text>
          </g>
        </g>
      </g>

      <!-- Status Tally & Submit -->
      <g transform="translate(0, 390)">
        <rect width="556" height="48" rx="8" fill="#041527"/>
        <text x="20" y="30" font-size="14" fill="#cbd5e1">Selected to discard:</text>
        <text x="175" y="31" font-family="'Bricolage Grotesque', sans-serif" font-size="18" font-weight="bold" fill="#86efac">4 of 4 required ✓</text>

        <rect y="60" width="556" height="50" rx="10" fill="#ef4444" filter="url(#glow-red)"/>
        <text x="278" y="92" font-family="'Bricolage Grotesque', sans-serif" font-size="17" font-weight="bold" fill="#fff" text-anchor="middle">Confirm &amp; Discard 4 Cards</text>
      </g>
    </g>
  </g>

  <!-- RIGHT: SCREEN B — VICTIM STEAL TARGET WHEEL (Active Player's Turn) -->
  <g id="Screen-B-Steal-Target-Wheel" transform="translate(740, 110)" filter="url(#modal-shadow)">
    <rect width="640" height="710" rx="18" fill="url(#modal-bg)" stroke="#f06800" stroke-width="2"/>
    
    <!-- Top Header -->
    <g transform="translate(32, 36)">
      <text font-family="'Bricolage Grotesque', sans-serif" font-size="24" font-weight="bold" fill="#ffffff">Step 2: Steal 1 Resource</text>
      <text y="22" font-size="13" fill="#fdba74">Robber placed on Pasture (Token #6). Choose an adjacent opponent to steal from.</text>
    </g>

    <!-- 3D Robber Pawn with Placement Elevation Shadow -->
    <g transform="translate(320, 220)" filter="url(#shadow-md)">
      <ellipse cx="0" cy="55" rx="35" ry="12" fill="rgba(0,0,0,0.6)"/>
      <polygon points="0,-40 -20,25 20,25" fill="#1f2937"/>
      <circle cx="0" cy="-45" r="16" fill="#111827" stroke="#374151" stroke-width="2"/>
      <text x="0" y="80" font-size="12" font-weight="bold" fill="#ffd54f" text-anchor="middle">ROBBER PLACED AT PASTURE #6</text>
    </g>

    <!-- Circular Victim Selection Cards -->
    <g transform="translate(32, 360)">
      <text x="0" y="0" font-size="14" font-weight="bold" fill="#ffd54f">ELIGIBLE VICTIMS (ADJACENT SETTLEMENTS)</text>

      <!-- Victim 1: Alice (Red - 5 cards) -->
      <g transform="translate(0, 20)" filter="url(#shadow-md)">
        <rect width="576" height="76" rx="12" fill="#061c33" stroke="#ef4444" stroke-width="2"/>
        <circle cx="40" cy="38" r="22" fill="#ef4444" stroke="#fff" stroke-width="2"/>
        <text x="75" y="32" font-size="16" font-weight="bold" fill="#fff">Alice</text>
        <text x="75" y="52" font-size="12" fill="#fca5a5">🏠 Settlement on vertex #18 • Holds 5 cards</text>
        <g transform="translate(420, 18)">
          <rect width="130" height="40" rx="8" fill="#f06800"/>
          <text x="65" y="25" font-size="13" font-weight="bold" fill="#fff" text-anchor="middle">🎯 Steal from Alice</text>
        </g>
      </g>

      <!-- Victim 2: Carol (Orange - 3 cards) -->
      <g transform="translate(0, 115)" filter="url(#shadow-md)">
        <rect width="576" height="76" rx="12" fill="#061c33" stroke="#f97316" stroke-width="2"/>
        <circle cx="40" cy="38" r="22" fill="#f97316" stroke="#fff" stroke-width="2"/>
        <text x="75" y="32" font-size="16" font-weight="bold" fill="#fff">Carol</text>
        <text x="75" y="52" font-size="12" fill="#fdba74">🏛 City on vertex #19 • Holds 3 cards</text>
        <g transform="translate(420, 18)">
          <rect width="130" height="40" rx="8" fill="#f06800"/>
          <text x="65" y="25" font-size="13" font-weight="bold" fill="#fff" text-anchor="middle">🎯 Steal from Carol</text>
        </g>
      </g>

      <!-- Steal Mechanics Info Box -->
      <g transform="translate(0, 215)">
        <rect width="576" height="60" rx="8" fill="#03111e" stroke="#1d4d7a"/>
        <text x="20" y="26" font-size="12" fill="#93c5fd">ℹ You will blindly draw 1 random resource card from their hand.</text>
        <text x="20" y="44" font-size="12" fill="#7fa6c9">Development cards cannot be stolen.</text>
      </g>
    </g>
  </g>
</svg>'''

    # -------------------------------------------------------------------------
    # 06_FLOW_DEV_CARDS_AND_SBP.svg
    # -------------------------------------------------------------------------
    svg_06 = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" width="1440" height="900" style="background:#03111e; font-family:'Rubik', system-ui, sans-serif;">
  <defs>
    <filter id="modal-shadow"><feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000" flood-opacity="0.8"/></filter>
    <filter id="shadow-md"><feDropShadow dx="0" dy="5" stdDeviation="8" flood-color="#000" flood-opacity="0.5"/></filter>
    <filter id="glow-gold"><feGaussianBlur stdDeviation="8" result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>

    <linearGradient id="modal-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0f3d69"/><stop offset="100%" stop-color="#072644"/></linearGradient>
  </defs>

  <rect width="1440" height="900" fill="#041a2e"/>

  <g transform="translate(60, 40)">
    <text font-family="'Bricolage Grotesque', sans-serif" font-size="28" font-weight="bold" fill="#ffffff">FLOW 8 &amp; 9: DEVELOPMENT CARDS &amp; SPECIAL BUILD PHASE</text>
    <text font-size="14" fill="#60a5fa" y="24">Interactive Hand Tray Activation • Monopoly / Year of Plenty Dialogs • 5-6 Player SBP Flag Alert</text>
  </g>

  <!-- LEFT: DEV CARD ACTIVATION TRAY (Flow 8) -->
  <g id="Dev-Card-Tray" transform="translate(60, 110)" filter="url(#modal-shadow)">
    <rect width="640" height="710" rx="18" fill="url(#modal-bg)" stroke="#1d64a6" stroke-width="2"/>

    <g transform="translate(32, 36)">
      <text font-family="'Bricolage Grotesque', sans-serif" font-size="24" font-weight="bold" fill="#ffffff">Your Development Cards</text>
      <text y="22" font-size="13" fill="#8cb3d9">Play max 1 Knight or Progress card per turn (cannot play turn purchased).</text>
    </g>

    <!-- 3 Cards in Hand -->
    <g transform="translate(32, 85)">
      <!-- 1. Playable Knight Card (Ready to Play) -->
      <g transform="translate(0, 0)" filter="url(#glow-gold)">
        <rect width="175" height="240" rx="10" fill="#132b45" stroke="#38bdf8" stroke-width="3"/>
        <rect x="8" y="8" width="159" height="34" rx="4" fill="#081e33"/>
        <text x="87" y="31" font-size="14" font-weight="bold" fill="#38bdf8" text-anchor="middle">⚔ KNIGHT</text>
        <circle cx="87" cy="110" r="40" fill="#040e1a" stroke="#38bdf8" stroke-width="1.5"/>
        <polygon points="76,96 98,96 87,130" fill="#cbd5e1"/>
        <text x="87" y="170" font-size="11" fill="#cbd5e1" text-anchor="middle">Move Robber &amp; Steal</text>
        <g transform="translate(18, 190)">
          <rect width="139" height="36" rx="6" fill="#0284c7"/>
          <text x="69" y="23" font-size="12" font-weight="bold" fill="#fff" text-anchor="middle">PLAY CARD ➜</text>
        </g>
      </g>

      <!-- 2. Year of Plenty Card (Bought This Turn -> LOCKED) -->
      <g transform="translate(200, 0)" opacity="0.6">
        <rect width="175" height="240" rx="10" fill="#132b45" stroke="#64748b" stroke-width="1.5"/>
        <rect x="8" y="8" width="159" height="34" rx="4" fill="#081e33"/>
        <text x="87" y="31" font-size="13" font-weight="bold" fill="#facc15" text-anchor="middle">YEAR OF PLENTY</text>
        <circle cx="87" cy="110" r="40" fill="#040e1a" stroke="#64748b" stroke-width="1"/>
        <text x="87" y="115" font-size="28" text-anchor="middle">🎁</text>
        <text x="87" y="170" font-size="11" fill="#94a3b8" text-anchor="middle">Take 2 Bank Cards</text>
        <!-- Lock Overlay Pill -->
        <g transform="translate(18, 190)">
          <rect width="139" height="36" rx="6" fill="#1e293b"/>
          <text x="69" y="23" font-size="11" font-weight="bold" fill="#f87171" text-anchor="middle">🔒 Playable next turn</text>
        </g>
      </g>

      <!-- 3. Victory Point Card (Chapel) -->
      <g transform="translate(400, 0)" filter="url(#glow-gold)">
        <rect width="175" height="240" rx="10" fill="#1a3528" stroke="#fbbf24" stroke-width="3"/>
        <rect x="8" y="8" width="159" height="34" rx="4" fill="#091d13"/>
        <text x="87" y="31" font-size="13" font-weight="bold" fill="#fbbf24" text-anchor="middle">🏆 CHAPEL (+1 VP)</text>
        <circle cx="87" cy="110" r="40" fill="#040e1a" stroke="#fbbf24" stroke-width="1.5"/>
        <text x="87" y="118" font-size="34" text-anchor="middle">⛪</text>
        <text x="87" y="170" font-size="12" font-weight="bold" fill="#fbbf24" text-anchor="middle">+1 VICTORY POINT</text>
        <g transform="translate(18, 190)">
          <rect width="139" height="36" rx="6" fill="#064e3b"/>
          <text x="69" y="23" font-size="11" fill="#a7f3d0" text-anchor="middle">Revealed on Win</text>
        </g>
      </g>
    </g>

    <!-- Monopoly Action Dialog Preview (Bottom Half) -->
    <g transform="translate(32, 360)">
      <rect width="576" height="300" rx="12" fill="#051c33" stroke="#1d4d7a" stroke-width="1.5"/>
      <text x="24" y="28" font-size="14" font-weight="bold" fill="#c084fc">MONOPOLY CARD ACTIVATION DIALOG</text>
      <text x="24" y="48" font-size="12" fill="#cbd5e1">Choose 1 resource: All other players must surrender their entire supply of that resource.</text>

      <!-- 5 Resource Choice Cards -->
      <g transform="translate(24, 70)">
        <g transform="translate(0, 0)"><rect width="90" height="90" rx="8" fill="#0a2e52" stroke="#3b82f6"/><text x="45" y="42" font-size="30" text-anchor="middle">🪵</text><text x="45" y="72" font-size="12" font-weight="bold" fill="#fff" text-anchor="middle">Lumber</text></g>
        <g transform="translate(105, 0)"><rect width="90" height="90" rx="8" fill="#ba5d2c" stroke="#fed7aa" stroke-width="2" filter="url(#glow-gold)"/><text x="45" y="42" font-size="30" text-anchor="middle">🧱</text><text x="45" y="72" font-size="12" font-weight="bold" fill="#fff" text-anchor="middle">Brick (Selected)</text></g>
        <g transform="translate(210, 0)"><rect width="90" height="90" rx="8" fill="#0a2e52" stroke="#3b82f6"/><text x="45" y="42" font-size="30" text-anchor="middle">🐑</text><text x="45" y="72" font-size="12" font-weight="bold" fill="#fff" text-anchor="middle">Wool</text></g>
        <g transform="translate(315, 0)"><rect width="90" height="90" rx="8" fill="#0a2e52" stroke="#3b82f6"/><text x="45" y="42" font-size="30" text-anchor="middle">🌾</text><text x="45" y="72" font-size="12" font-weight="bold" fill="#fff" text-anchor="middle">Grain</text></g>
        <g transform="translate(420, 0)"><rect width="90" height="90" rx="8" fill="#0a2e52" stroke="#3b82f6"/><text x="45" y="42" font-size="30" text-anchor="middle">⛰</text><text x="45" y="72" font-size="12" font-weight="bold" fill="#fff" text-anchor="middle">Ore</text></g>
      </g>

      <!-- Claim Monopoly CTA -->
      <g transform="translate(24, 210)">
        <rect width="528" height="50" rx="10" fill="#a855f7" filter="url(#shadow-md)"/>
        <text x="264" y="32" font-family="'Bricolage Grotesque', sans-serif" font-size="16" font-weight="bold" fill="#fff" text-anchor="middle">Claim All Brick from Players</text>
      </g>
    </g>
  </g>

  <!-- RIGHT: 5-6 PLAYER SPECIAL BUILD PHASE (Flow 9) -->
  <g id="Special-Build-Phase-Screen" transform="translate(740, 110)" filter="url(#modal-shadow)">
    <rect width="640" height="710" rx="18" fill="url(#modal-bg)" stroke="#ef4444" stroke-width="2"/>

    <!-- Red Flag Alert Top Banner -->
    <rect width="640" height="70" rx="18" fill="#dc2626" filter="url(#shadow-md)"/>
    <text x="40" y="36" font-size="30">🚩</text>
    <g transform="translate(85, 26)">
      <text font-family="'Bricolage Grotesque', sans-serif" font-size="20" font-weight="bold" fill="#ffffff">5-6 PLAYER SPECIAL BUILD PHASE ACTIVE</text>
      <text y="20" font-size="12" fill="#fecaca">Between opponent turns, non-active players may build or buy development cards.</text>
    </g>

    <!-- Turn Window Indicator -->
    <g transform="translate(32, 100)">
      <rect width="576" height="70" rx="10" fill="#051c33" stroke="#38bdf8" stroke-width="2"/>
      <g transform="translate(20, 20)">
        <text font-size="15" font-weight="bold" fill="#fff">Current Window: Bob (You)</text>
        <text y="20" font-size="12" fill="#7fa6c9">You may build roads, settlements, cities, or buy dev cards.</text>
      </g>
      <!-- Timer -->
      <g transform="translate(450, 15)">
        <rect width="105" height="40" rx="6" fill="#041527" stroke="#f06800" stroke-width="1.5"/>
        <text x="52" y="16" font-size="10" font-weight="bold" fill="#ffaa66" text-anchor="middle">SBP TIMER</text>
        <text x="52" y="32" font-family="monospace" font-size="14" font-weight="bold" fill="#fff" text-anchor="middle">00:24</text>
      </g>
    </g>

    <!-- Allowed vs Forbidden Legend -->
    <g transform="translate(32, 195)">
      <rect width="576" height="130" rx="10" fill="#03111e" stroke="#1e4e7a"/>
      <g transform="translate(24, 24)">
        <text font-size="13" font-weight="bold" fill="#4ade80">ALLOWED IN SBP (✅)</text>
        <text y="24" font-size="12" fill="#cbd5e1">• Build Roads, Settlements, &amp; Cities</text>
        <text y="44" font-size="12" fill="#cbd5e1">• Buy Development Cards</text>
      </g>
      <g transform="translate(300, 24)">
        <text font-size="13" font-weight="bold" fill="#f87171">FORBIDDEN IN SBP (❌)</text>
        <text y="24" font-size="12" fill="#cbd5e1">• No Trading (neither bank nor players)</text>
        <text y="44" font-size="12" fill="#cbd5e1">• No Playing Development Cards</text>
        <text y="64" font-size="12" fill="#cbd5e1">• Cannot claim victory (waits for own turn)</text>
      </g>
    </g>

    <!-- SBP Action Dock -->
    <g transform="translate(32, 350)">
      <text x="0" y="0" font-size="14" font-weight="bold" fill="#ffd54f">SBP BUILD CONTROLS</text>

      <g transform="translate(0, 15)">
        <!-- Road -->
        <rect width="135" height="60" rx="8" fill="#0f3d69" stroke="#3b82f6"/>
        <text x="67" y="26" font-size="14" font-weight="bold" fill="#fff" text-anchor="middle">🛣 Road</text>
        <text x="67" y="46" font-size="12" fill="#ffd54f" text-anchor="middle">🪵1 🧱1</text>

        <!-- Settlement -->
        <g transform="translate(145, 0)">
          <rect width="140" height="60" rx="8" fill="#0f3d69" stroke="#3b82f6"/>
          <text x="70" y="26" font-size="14" font-weight="bold" fill="#fff" text-anchor="middle">🏠 Settlement</text>
          <text x="70" y="46" font-size="12" fill="#ffd54f" text-anchor="middle">🪵1 🧱1 🐑1 🌾1</text>
        </g>

        <!-- City -->
        <g transform="translate(295, 0)">
          <rect width="135" height="60" rx="8" fill="#0f3d69" stroke="#3b82f6"/>
          <text x="67" y="26" font-size="14" font-weight="bold" fill="#fff" text-anchor="middle">🏛 City</text>
          <text x="67" y="46" font-size="12" fill="#ffd54f" text-anchor="middle">🌾2 ⛰3</text>
        </g>

        <!-- Buy Dev -->
        <g transform="translate(440, 0)">
          <rect width="135" height="60" rx="8" fill="#0f3d69" stroke="#3b82f6"/>
          <text x="67" y="26" font-size="14" font-weight="bold" fill="#fff" text-anchor="middle">🃏 Dev Card</text>
          <text x="67" y="46" font-size="12" fill="#ffd54f" text-anchor="middle">🐑1 🌾1 ⛰1</text>
        </g>
      </g>
    </g>

    <!-- Pass SBP Window Button -->
    <g transform="translate(32, 580)">
      <rect width="576" height="55" rx="10" fill="#dc2626" filter="url(#shadow-md)"/>
      <text x="288" y="34" font-family="'Bricolage Grotesque', sans-serif" font-size="17" font-weight="bold" fill="#fff" text-anchor="middle">Pass Build Window ➜</text>
    </g>
  </g>
</svg>'''

    # -------------------------------------------------------------------------
    # 07_FLOW_VICTORY_CELEBRATION.svg
    # -------------------------------------------------------------------------
    svg_07 = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" width="1440" height="900" style="background:#03111e; font-family:'Rubik', system-ui, sans-serif;">
  <defs>
    <filter id="podium-shadow"><feDropShadow dx="0" dy="20" stdDeviation="30" flood-color="#000" flood-opacity="0.85"/></filter>
    <filter id="glow-gold"><feGaussianBlur stdDeviation="12" result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>

    <linearGradient id="podium-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0e3d69"/><stop offset="100%" stop-color="#041829"/></linearGradient>
    <linearGradient id="winner-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fef08a"/><stop offset="50%" stop-color="#facc15"/><stop offset="100%" stop-color="#ca8a04"/></linearGradient>
  </defs>

  <rect width="1440" height="900" fill="#041a2e"/>

  <!-- Confetti Shower Particles Across Screen -->
  <g opacity="0.85">
    <rect x="220" y="80" width="12" height="24" rx="2" fill="#ffd54f" transform="rotate(25, 220, 80)"/>
    <rect x="420" y="140" width="14" height="26" rx="2" fill="#38bdf8" transform="rotate(-35, 420, 140)"/>
    <rect x="620" y="60" width="16" height="28" rx="2" fill="#ef4444" transform="rotate(45, 620, 60)"/>
    <rect x="850" y="110" width="14" height="25" rx="2" fill="#22c55e" transform="rotate(-15, 850, 110)"/>
    <rect x="1100" y="90" width="16" height="26" rx="2" fill="#eab308" transform="rotate(30, 1100, 90)"/>
    <rect x="1280" y="160" width="12" height="22" rx="2" fill="#a855f7" transform="rotate(-40, 1280, 160)"/>
    <!-- Lower particles -->
    <circle cx="180" cy="320" r="6" fill="#ffd54f"/>
    <circle cx="340" cy="540" r="7" fill="#ef4444"/>
    <circle cx="1200" cy="420" r="8" fill="#38bdf8"/>
    <circle cx="1320" cy="620" r="6" fill="#22c55e"/>
  </g>

  <!-- Title Indicator -->
  <g transform="translate(60, 45)">
    <text font-family="'Bricolage Grotesque', sans-serif" font-size="28" font-weight="bold" fill="#ffffff">FLOW 10: VICTORY CELEBRATION PODIUM</text>
    <text font-size="14" fill="#ffd54f" y="24">Game Over Screen • Canvas Confetti Cascade • Animated Victory Point Breakdown Ledger • Rematch Lobby Return</text>
  </g>

  <!-- CENTER VICTORY PODIUM CARD (Width: 780px, Height: 720px) -->
  <g id="Victory-Podium-Card" transform="translate(330, 100)" filter="url(#podium-shadow)">
    <!-- Base Card Container -->
    <rect width="780" height="720" rx="24" fill="url(#podium-bg)" stroke="url(#winner-gold)" stroke-width="3"/>

    <!-- Gold Cup Trophy Header -->
    <g transform="translate(390, 85)" filter="url(#glow-gold)">
      <circle cx="0" cy="0" r="48" fill="#061c33" stroke="url(#winner-gold)" stroke-width="3"/>
      <!-- Trophy Icon -->
      <path d="M-22,-20 L22,-20 L16,10 Q0,20 -16,10 Z" fill="url(#winner-gold)"/>
      <rect x="-6" y="14" width="12" height="12" fill="#d97706"/>
      <rect x="-18" y="26" width="36" height="8" rx="2" fill="#b45309"/>
      <!-- Handles -->
      <path d="M-22,-15 Q-34,-10 -20,4" fill="none" stroke="url(#winner-gold)" stroke-width="3"/>
      <path d="M22,-15 Q34,-10 20,4" fill="none" stroke="url(#winner-gold)" stroke-width="3"/>
    </g>

    <!-- Winner Announcement Header -->
    <g transform="translate(390, 185)" text-anchor="middle">
      <text font-family="'Bricolage Grotesque', sans-serif" font-size="38" font-weight="bold" fill="url(#winner-gold)">BOB VICTORIOUS!</text>
      <text y="30" font-size="16" fill="#86efac">First player to reach 10 Victory Points on their turn</text>
    </g>

    <!-- VICTORY POINT BREAKDOWN LEDGER (Grid of 6 source cards) -->
    <g transform="translate(45, 250)">
      <text x="0" y="0" font-size="14" font-weight="bold" fill="#ffd54f">VICTORY POINT BREAKDOWN (10 VP TOTAL)</text>

      <!-- Grid 2x3 of Scoring Sources -->
      <!-- 1. Settlements -->
      <g transform="translate(0, 15)">
        <rect width="330" height="72" rx="10" fill="#061c33" stroke="#1d4d7a"/>
        <text x="20" y="44" font-size="28">🏠</text>
        <text x="65" y="32" font-size="15" font-weight="bold" fill="#fff">Settlements (2 Built)</text>
        <text x="65" y="52" font-size="12" fill="#7fa6c9">1 Point each</text>
        <text x="290" y="45" font-family="'Bricolage Grotesque', sans-serif" font-size="24" font-weight="bold" fill="#ffd54f">+2</text>
      </g>

      <!-- 2. Cities -->
      <g transform="translate(360, 15)">
        <rect width="330" height="72" rx="10" fill="#061c33" stroke="#1d4d7a"/>
        <text x="20" y="44" font-size="28">🏛</text>
        <text x="65" y="32" font-size="15" font-weight="bold" fill="#fff">Cities (2 Upgraded)</text>
        <text x="65" y="52" font-size="12" fill="#7fa6c9">2 Points each</text>
        <text x="290" y="45" font-family="'Bricolage Grotesque', sans-serif" font-size="24" font-weight="bold" fill="#ffd54f">+4</text>
      </g>

      <!-- 3. Longest Road -->
      <g transform="translate(0, 100)">
        <rect width="330" height="72" rx="10" fill="#061c33" stroke="#f97316" stroke-width="2"/>
        <text x="20" y="44" font-size="28">🛣</text>
        <text x="65" y="32" font-size="15" font-weight="bold" fill="#fff">Longest Road Award</text>
        <text x="65" y="52" font-size="12" fill="#fdba74">7 Continuous Segments</text>
        <text x="290" y="45" font-family="'Bricolage Grotesque', sans-serif" font-size="24" font-weight="bold" fill="#ffd54f">+2</text>
      </g>

      <!-- 4. Largest Army -->
      <g transform="translate(360, 100)">
        <rect width="330" height="72" rx="10" fill="#061c33" stroke="#334155" opacity="0.6"/>
        <text x="20" y="44" font-size="28">⚔</text>
        <text x="65" y="32" font-size="15" font-weight="bold" fill="#94a3b8">Largest Army</text>
        <text x="65" y="52" font-size="12" fill="#64748b">Held by Carol (3 Knights)</text>
        <text x="290" y="45" font-size="20" font-weight="bold" fill="#64748b">0</text>
      </g>

      <!-- 5. Revealed VP Dev Cards -->
      <g transform="translate(0, 185)">
        <rect width="690" height="72" rx="10" fill="#092518" stroke="#10b981" stroke-width="2"/>
        <text x="20" y="44" font-size="28">🏆</text>
        <text x="65" y="32" font-size="15" font-weight="bold" fill="#fff">Revealed Victory Point Cards (2)</text>
        <text x="65" y="52" font-size="12" fill="#86efac">Chapel (+1) • Great Hall (+1) — Auto-revealed upon victory</text>
        <text x="650" y="45" font-family="'Bricolage Grotesque', sans-serif" font-size="24" font-weight="bold" fill="#ffd54f">+2</text>
      </g>
    </g>

    <!-- Table Final Standings -->
    <g transform="translate(45, 545)">
      <rect width="690" height="60" rx="8" fill="#041527"/>
      <text x="24" y="36" font-size="13" fill="#cbd5e1">Final Score: <b style="color:#38bdf8">Bob: 10 VP</b> • <b style="color:#ef4444">Alice: 7 VP</b> • <b style="color:#f97316">Carol: 6 VP</b> • <b style="color:#cbd5e1">Dave: 4 VP</b></text>
      <text x="560" y="36" font-size="12" fill="#86efac">Match time: 24m 12s</text>
    </g>

    <!-- CTA Buttons (Rematch & Lobby) -->
    <g transform="translate(45, 625)">
      <!-- Rematch Button -->
      <rect width="335" height="54" rx="12" fill="#f06800" filter="url(#glow-gold)"/>
      <text x="167" y="34" font-family="'Bricolage Grotesque', sans-serif" font-size="18" font-weight="bold" fill="#ffffff" text-anchor="middle">🎲 Play Rematch (Same Seats)</text>

      <!-- Return to Lobby Button -->
      <g transform="translate(355, 0)">
        <rect width="335" height="54" rx="12" fill="#061c33" stroke="#1d4d7a" stroke-width="1.5"/>
        <text x="167" y="34" font-family="'Bricolage Grotesque', sans-serif" font-size="18" font-weight="bold" fill="#cbd5e1" text-anchor="middle">Return to Lobby</text>
      </g>
    </g>
  </g>
</svg>'''

    with open("docs/design/04_FLOW_TRADE_NEGOTIATION.svg", "w", encoding="utf-8") as f:
        f.write(svg_04)
    print("Generated 04_FLOW_TRADE_NEGOTIATION.svg")

    with open("docs/design/05_FLOW_ROBBER_AND_DISCARD.svg", "w", encoding="utf-8") as f:
        f.write(svg_05)
    print("Generated 05_FLOW_ROBBER_AND_DISCARD.svg")

    with open("docs/design/06_FLOW_DEV_CARDS_AND_SBP.svg", "w", encoding="utf-8") as f:
        f.write(svg_06)
    print("Generated 06_FLOW_DEV_CARDS_AND_SBP.svg")

    with open("docs/design/07_FLOW_VICTORY_CELEBRATION.svg", "w", encoding="utf-8") as f:
        f.write(svg_07)
    print("Generated 07_FLOW_VICTORY_CELEBRATION.svg")

generate_remaining()
