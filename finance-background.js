/* Cenário decorativo, independente dos dados e dos gráficos financeiros. */
(() => {
    'use strict';
    const layer = document.createElement('div');
    layer.className = 'finance-backdrop';
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = `<svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
            <pattern id="finance-grid" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M100 0H0V100" fill="none" stroke="currentColor" stroke-width=".5"/></pattern>
            <linearGradient id="finance-fade" x2="0" y2="1"><stop stop-color="white" stop-opacity=".85"/><stop offset=".48" stop-color="white" stop-opacity=".12"/><stop offset="1" stop-color="white" stop-opacity=".7"/></linearGradient>
            <mask id="finance-mask"><rect width="1600" height="1000" fill="url(#finance-fade)"/></mask>
        </defs>
        <g mask="url(#finance-mask)">
            <rect width="1600" height="1000" fill="url(#finance-grid)" class="finance-grid"/>
            <g class="finance-candles" fill="none" stroke="currentColor" stroke-width="1">
                <path d="M120 765V900m-12-105h24v65h-24z M240 690V825m-12-105h24v60h-24z M360 720V865m-12-110h24v60h-24z M480 595V750m-12-115h24v70h-24z M600 535V685m-12-120h24v70h-24z M720 600V745m-12-115h24v60h-24z M840 480V635m-12-120h24v70h-24z M960 430V580m-12-120h24v60h-24z M1080 485V625m-12-110h24v60h-24z M1200 350V510m-12-125h24v75h-24z M1320 285V435m-12-120h24v60h-24z M1440 215V380m-12-130h24v75h-24z"/>
            </g>
            <path class="finance-line" d="M-80 850L80 810 200 725 320 770 450 630 570 570 690 640 820 525 950 470 1070 540 1200 390 1320 330 1440 270 1680 160"/>
            <path class="finance-trace" pathLength="100" d="M-80 850L80 810 200 725 320 770 450 630 570 570 690 640 820 525 950 470 1070 540 1200 390 1320 330 1440 270 1680 160"/>
            <path class="finance-secondary" d="M-80 320L80 350 220 290 350 330 490 240 620 280 760 190 900 225 1040 150 1200 200 1370 110 1680 140"/>
        </g>
    </svg>`;
    document.body.prepend(layer);
})();
