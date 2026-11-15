
(function () {
    'use strict';

    // ===== DOM REFS =====
    const formLogin = document.getElementById('formLogin');
    const formCadastro = document.getElementById('formCadastro');
    const successMsg = document.getElementById('successMessage');

    const loginForm = document.getElementById('loginForm');
    const cadastroForm = document.getElementById('cadastroForm');

    const goToCadastroBtn = document.getElementById('goToCadastro');
    const goToLoginBtn = document.getElementById('goToLogin');
    try { document.querySelector('.login-options input').checked = localStorage.getItem('fingsec_remember') === 'true'; } catch {}
    const fields = {
        loginEmail: ['E-mail', 'email'], loginPassword: ['Senha', 'current-password'],
        cadastroNome: ['Nome completo', 'name'], cadastroEmail: ['E-mail', 'email'],
        cadastroPassword: ['Crie uma senha', 'new-password'], cadastroConfirm: ['Confirme a senha', 'new-password']
    };
    Object.entries(fields).forEach(([id, [label, autocomplete]]) => {
        const input = document.getElementById(id);
        input.setAttribute('aria-label', label);
        input.setAttribute('autocomplete', autocomplete);
        input.setAttribute('aria-describedby', id + 'Error');
    });
    document.querySelectorAll('.toggle-password').forEach(button => button.setAttribute('aria-label', 'Mostrar ou ocultar senha'));
    const recovery = document.querySelector('.login-options a');
    recovery.addEventListener('click', event => {
        event.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        if (!isValidEmail(email)) return setError('loginEmail', 'Informe seu e-mail para recuperar a senha.');
        (async () => {
            try {
                const { error } = await window.FinCloud.connection().auth.resetPasswordForEmail(email, { redirectTo: new URL('index.html', window.location.href).href });
                if (error) throw error;
                setError('loginPassword', 'Se houver uma conta, você receberá o link de recuperação.');
            } catch { setError('loginPassword', 'Não foi possível solicitar a recuperação. Confira a configuração e tente novamente.'); }
        })();
    });

    // ===== TOGGLE FORMS =====
    function showForm(formToShow) {
        // Oculta todos os formulários e mensagem de sucesso
        [formLogin, formCadastro, successMsg].forEach(el => {
            el.classList.remove('active', 'show');
            el.style.display = 'none';
        });

        // Exibe o formulário alvo com animação
        if (formToShow === 'login') {
            formLogin.style.display = 'block';
            // Força reflow para animar
            void formLogin.offsetWidth;
            formLogin.classList.add('active');
        } else if (formToShow === 'cadastro') {
            formCadastro.style.display = 'block';
            void formCadastro.offsetWidth;
            formCadastro.classList.add('active');
        } else if (formToShow === 'success') {
            successMsg.style.display = 'flex';
            void successMsg.offsetWidth;
            successMsg.classList.add('show');
        }

        // Limpa erros ao trocar de tela
        clearAllErrors();
    }

    // Botões de alternância
    goToCadastroBtn.addEventListener('click', () => showForm('cadastro'));
    goToLoginBtn.addEventListener('click', () => showForm('login'));

    // ===== MOSTRAR/OCULTAR SENHA =====
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', function () {
            const targetId = this.dataset.target;
            const input = document.getElementById(targetId);
            if (!input) return;

            const icon = this.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    });

    // ===== VALIDAÇÃO =====
    function setError(inputId, message) {
        const errorSpan = document.getElementById(inputId + 'Error');
        if (errorSpan) {
            errorSpan.textContent = message;
            document.getElementById(inputId)?.setAttribute('aria-invalid', 'true');
        }
    }

    function clearError(inputId) {
        const errorSpan = document.getElementById(inputId + 'Error');
        if (errorSpan) {
            errorSpan.textContent = '';
            document.getElementById(inputId)?.removeAttribute('aria-invalid');
        }
    }

    function clearAllErrors() {
        document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
    }

    // Valida e-mail simples
    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    // Validação do formulário de login
    function validateLogin() {
        let valid = true;
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!email) {
            setError('loginEmail', 'Informe seu e-mail.');
            valid = false;
        } else if (!isValidEmail(email)) {
            setError('loginEmail', 'E-mail inválido.');
            valid = false;
        } else {
            clearError('loginEmail');
        }

        if (!password) {
            setError('loginPassword', 'Informe sua senha.');
            valid = false;
        } else if (password.length < 6) {
            setError('loginPassword', 'Mínimo de 6 caracteres.');
            valid = false;
        } else {
            clearError('loginPassword');
        }

        return valid;
    }

    // Validação do formulário de cadastro
    function validateCadastro() {
        let valid = true;
        const nome = document.getElementById('cadastroNome').value.trim();
        const email = document.getElementById('cadastroEmail').value.trim();
        const password = document.getElementById('cadastroPassword').value;
        const confirm = document.getElementById('cadastroConfirm').value;

        // Nome
        if (!nome) {
            setError('cadastroNome', 'Informe seu nome completo.');
            valid = false;
        } else if (nome.length < 3) {
            setError('cadastroNome', 'Nome deve ter ao menos 3 caracteres.');
            valid = false;
        } else {
            clearError('cadastroNome');
        }

        // E-mail
        if (!email) {
            setError('cadastroEmail', 'Informe seu e-mail.');
            valid = false;
        } else if (!isValidEmail(email)) {
            setError('cadastroEmail', 'E-mail inválido.');
            valid = false;
        } else {
            clearError('cadastroEmail');
        }

        // Senha
        if (!password) {
            setError('cadastroPassword', 'Crie uma senha.');
            valid = false;
        } else if (password.length < 6) {
            setError('cadastroPassword', 'Mínimo de 6 caracteres.');
            valid = false;
        } else {
            clearError('cadastroPassword');
        }

        // Confirmar senha
        if (!confirm) {
            setError('cadastroConfirm', 'Repita a senha.');
            valid = false;
        } else if (confirm !== password) {
            setError('cadastroConfirm', 'As senhas não coincidem.');
            valid = false;
        } else {
            clearError('cadastroConfirm');
        }

        return valid;
    }

    // Os dados de acesso são enviados somente ao Supabase Auth.
    loginForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!validateLogin()) return;
        const button = loginForm.querySelector('button[type="submit"]');
        if (button.disabled) return; button.disabled = true;
        try {
            localStorage.setItem('fingsec_remember', String(document.querySelector('.login-options input').checked));
            const { error } = await window.FinCloud.connection().auth.signInWithPassword({ email: document.getElementById('loginEmail').value.trim(), password: document.getElementById('loginPassword').value });
            if (error) throw new Error('E-mail ou senha inválidos, ou e-mail ainda não confirmado.');
            window.location.href = 'pages/main/main.html';
        } catch (error) { setError('loginPassword', error.message); }
        finally { button.disabled = false; }
    });
    cadastroForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!validateCadastro()) return;
        const button = cadastroForm.querySelector('button[type="submit"]');
        if (button.disabled) return; button.disabled = true;
        try {
            const { data, error } = await window.FinCloud.connection().auth.signUp({
                email: document.getElementById('cadastroEmail').value.trim(), password: document.getElementById('cadastroPassword').value,
                options: { data: { nome: document.getElementById('cadastroNome').value.trim() }, emailRedirectTo: new URL('index.html', window.location.href).href }
            });
            if (error) throw new Error('Não foi possível cadastrar. Confira os dados e tente novamente.');
            if (data.session) { window.location.href = 'pages/main/main.html'; return; }
            showForm('success');
            successMsg.querySelector('p').textContent = 'Confira seu e-mail para confirmar o cadastro.';
            cadastroForm.reset();
            setTimeout(() => showForm('login'), 5000);
        } catch (error) { setError('cadastroEmail', error.message); }
        finally { button.disabled = false; }
    });
    try {
        window.FinCloud.connection().auth.onAuthStateChange(event => {
            if (event === 'PASSWORD_RECOVERY') {
                document.getElementById('passwordReset').hidden = false;
                [formLogin, formCadastro, successMsg].forEach(el => el.style.display = 'none');
            }
        });
    } catch (error) { setError('loginPassword', error.message); }
    document.getElementById('resetPasswordForm').addEventListener('submit', async event => {
        event.preventDefault();
        const button = event.target.querySelector('button'); button.disabled = true;
        const status = document.getElementById('resetStatus');
        try {
            const { error } = await window.FinCloud.connection().auth.updateUser({ password: document.getElementById('newPassword').value });
            if (error) throw error;
            await window.FinCloud.signOut();
            window.location.replace('index.html');
        } catch { status.textContent = 'Não foi possível atualizar a senha. Solicite um novo link.'; }
        finally { button.disabled = false; }
    });

    // Validação ao sair do campo.
    // Aciona validação ao sair do campo (blur) para feedback imediato
    document.querySelectorAll('.input-wrapper input').forEach(input => {
        input.addEventListener('blur', function () {
            const form = this.closest('form');
            if (form.id === 'loginForm') {
                // Valida apenas o campo específico no login
                const id = this.id;
                const value = this.value.trim();
                if (id === 'loginEmail') {
                    if (value && !isValidEmail(value)) {
                        setError('loginEmail', 'E-mail inválido.');
                    } else {
                        clearError('loginEmail');
                    }
                }
                if (id === 'loginPassword') {
                    if (value && value.length < 6) {
                        setError('loginPassword', 'Mínimo de 6 caracteres.');
                    } else {
                        clearError('loginPassword');
                    }
                }
            } else if (form.id === 'cadastroForm') {
                // Valida campos do cadastro individualmente
                const id = this.id;
                const value = this.value.trim();
                switch (id) {
                    case 'cadastroNome':
                        if (value && value.length < 3) {
                            setError('cadastroNome', 'Mínimo de 3 caracteres.');
                        } else {
                            clearError('cadastroNome');
                        }
                        break;
                    case 'cadastroEmail':
                        if (value && !isValidEmail(value)) {
                            setError('cadastroEmail', 'E-mail inválido.');
                        } else {
                            clearError('cadastroEmail');
                        }
                        break;
                    case 'cadastroPassword':
                        if (value && value.length < 6) {
                            setError('cadastroPassword', 'Mínimo de 6 caracteres.');
                        } else {
                            clearError('cadastroPassword');
                        }
                        break;
                    case 'cadastroConfirm':
                        const password = document.getElementById('cadastroPassword').value;
                        if (value && value !== password) {
                            setError('cadastroConfirm', 'As senhas não coincidem.');
                        } else {
                            clearError('cadastroConfirm');
                        }
                        break;
                }
            }
        });
    });

})();
