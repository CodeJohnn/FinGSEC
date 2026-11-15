/* Abertura visual com duração limitada, sem interferir na autenticação. */
(() => {
    'use strict';
    const root = document.documentElement;
    const sessionKey = 'fingsec_intro_seen';
    const callback = /(?:[?#&])(?:code|access_token|refresh_token|token_hash|error|type)=/i.test(location.search + location.hash);
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    // Sem armazenamento de sessão, prioriza acesso direto em vez de repetir.
    try {
        if (sessionStorage.getItem(sessionKey)) return;
        sessionStorage.setItem(sessionKey, '1');
    } catch { return; }
    if (callback || preference.matches) return;
    root.classList.add('intro-active');
    let finished = false;
    function finish() {
        if (finished) return;
        finished = true;
        const focusLogin = document.activeElement?.classList.contains('brand-intro-skip');
        root.classList.remove('intro-active');
        root.classList.add('intro-leaving');
        setTimeout(() => {
            root.classList.remove('intro-leaving');
            if (focusLogin) document.getElementById('loginEmail')?.focus({ preventScroll: true });
        }, 400);
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('click', onClick);
        preference.removeEventListener('change', onPreference);
    }
    function onKey(event) { if (event.key === 'Escape') finish(); }
    function onClick(event) { if (event.target.closest('.brand-intro-skip')) finish(); }
    function onPreference(event) { if (event.matches) finish(); }
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    preference.addEventListener('change', onPreference);
    // Independe do carregamento de bibliotecas externas e de eventos de animação.
    setTimeout(finish, 2100);
})();
