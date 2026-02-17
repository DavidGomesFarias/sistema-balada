document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user && user.name && window.location.pathname.includes('index.html')) {
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            userNameElement.textContent = user.name;
        } else {
            console.error('Elemento com id "userName" não encontrado no DOM');
        }
        if (typeof loadEscalas === 'function') {
            loadEscalas();
        }
    } else if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('register.html')) {
        console.error('Usuário não encontrado no localStorage ou nome inválido');
        window.location.href = 'login.html';
    }

    function startCountdown(seconds) {
        const messageElement = document.getElementById('rateLimitMessage');
        if (!messageElement) {
            console.error('Elemento rateLimitMessage não encontrado');
            return;
        }
        messageElement.textContent = `Muitas tentativas de login. Tente novamente em ${seconds} segundos.`;
        messageElement.classList.remove('hidden');

        const submitBtn = document.getElementById('submitBtn');
        if (!submitBtn) {
            console.error('Elemento submitBtn não encontrado');
            return;
        }
        submitBtn.disabled = true;

        const interval = setInterval(() => {
            seconds--;
            if (seconds <= 0) {
                clearInterval(interval);
                messageElement.classList.add('hidden');
                submitBtn.disabled = false;
            } else {
                messageElement.textContent = `Muitas tentativas de login. Tente novamente em ${seconds} segundos.`;
            }
        }, 1000);
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const API_BASE = window.location.origin;
            try {
                const response = await fetch(`${API_BASE}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await response.json();
                console.log('Resposta do servidor:', data); // Depuração
                if (response.ok) {
                    localStorage.setItem('user', JSON.stringify(data.user));
                    window.location.href = 'index.html';
                } else if (response.status === 429) {
                    const retryAfter = data.retryAfter || 15 * 60; // Fallback se retryAfter não estiver presente
                    startCountdown(retryAfter);
                } else {
                    alert(data.error);
                }
            } catch (err) {
                console.error('Erro ao fazer login:', err);
                alert('Erro ao fazer login');
            }
        });
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const API_BASE = window.location.origin;
            try {
                const response = await fetch(`${API_BASE}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });
                const data = await response.json();
                if (response.ok) {
                    alert('Cadastro realizado com sucesso!');
                    window.location.href = 'login.html';
                } else {
                    alert(data.error);
                }
            } catch (err) {
                console.error('Erro ao cadastrar:', err);
                alert('Erro ao cadastrar');
            }
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        });
    }
    
});

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(`eye-icon-${inputId}`);
    if (input.type === 'password') {
        input.type = 'text';
        icon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
            <line x1="1" y1="1" x2="23" y2="23"></line>
        `;
    } else {
        input.type = 'password';
        icon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        `;
    }
}

async function atualizarRelatorio() {
    const user = JSON.parse(localStorage.getItem('user'));
    const API_BASE = window.location.origin;
    try {
        const response = await fetch(`${API_BASE}/escalas?user_id=${user.id}`);
        const escalas = await response.json();
        if (response.ok) {
            let escaladoCount = 0;
            let presencaCount = 0;
            let valorEstimado = 0;
            let valorReal = 0;

            escalas.forEach(escala => {
                if (escala.status === 'escalado') {
                    escaladoCount++;
                    valorEstimado += 150;
                } else if (escala.status === 'foi') {
                    presencaCount++;
                    valorReal += 150;
                }
            });

            document.getElementById('escalasCount').textContent = `Escalado: ${escaladoCount}`;
            document.getElementById('valorEstimado').textContent = valorEstimado.toFixed(2);
            document.getElementById('baladasCount').textContent = `Baladas Concluídas: ${presencaCount}`;
            document.getElementById('valorReal').textContent = valorReal.toFixed(2);
        }
    } catch (err) {
        console.error('Erro ao atualizar relatório:', err);
    }
}

// Modal de dados pessoais
const openUserModal = document.getElementById('openUserModal');
const userModal = document.getElementById('userModal');
const closeUserModal = document.getElementById('closeUserModal');

if (openUserModal && userModal && closeUserModal) {
    openUserModal.addEventListener('click', async () => {
        const user = JSON.parse(localStorage.getItem('user'));
        const userId = user.id;
        const API_BASE = window.location.origin;
        try {
            const response = await fetch(`${API_BASE}/user/${userId}`);
            const userData = await response.json();
            if (response.ok) {
                console.log('Dados do usuário:', userData); // Adiciona log para depuração
                document.getElementById('modalName').value = userData.name || 'Não informado';
                document.getElementById('modalEmail').value = userData.email || 'Não informado';
                document.getElementById('modalCpf').value = userData.cpf || 'Não informado';
                userModal.classList.remove('hidden');
                document.body.classList.add('overflow-hidden');
            } else {
                alert(userData.error || 'Erro ao carregar os dados');
            }
        } catch (err) {
            console.error('Erro ao buscar dados do usuário:', err);
            alert('Erro ao buscar dados do usuário');
        }
    });

    closeUserModal.addEventListener('click', () => {
        userModal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    });
}