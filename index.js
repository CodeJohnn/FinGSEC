/**
 * Sistema de Login e Cadastro
 * Alterna entre formulários com animação, valida campos e gerencia feedback visual.
 */

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
        }
    }

    function clearError(inputId) {
        const errorSpan = document.getElementById(inputId + 'Error');
        if (errorSpan) {
            errorSpan.textContent = '';
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

    // ===== SUBMIT LOGIN =====
    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!validateLogin()) return;

        // Simula login bem-sucedido → redireciona
        window.location.href = 'pages/main/main.html';
    });

    // ===== SUBMIT CADASTRO =====
    cadastroForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!validateCadastro()) return;

        // Armazena nome do usuário e mostra mensagem de sucesso
        const nome = document.getElementById('cadastroNome').value.trim();
        try { localStorage.setItem('usuarioNome', nome); } catch (err) { /* storage pode estar desabilitado */ }

        // Cadastro bem-sucedido → mostra mensagem de sucesso e volta ao login
        showForm('success');

        setTimeout(() => {
            showForm('login');
            // Limpa os campos do cadastro
            cadastroForm.reset();
            clearAllErrors();
        }, 2000);
    });

    // ===== VALIDAÇÃO EM TEMPO REAL (opcional) =====
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