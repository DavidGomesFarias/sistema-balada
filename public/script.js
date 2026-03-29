document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = window.location.origin;
    const token = localStorage.getItem('token');

    // 🔐 Proteção de rota
    if (!token && window.location.pathname.includes('index.html')) {
        window.location.href = 'login.html';
        return;
    }

    // 🔧 Helper para requisições autenticadas
    function authFetch(url, options = {}) {
        return fetch(url, {
            ...options,
            headers: {
                ...(options.headers || {}),
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    }

    // 🧠 Carregar dados iniciais
    if (token && window.location.pathname.includes('index.html')) {
        loadUser();
        if (typeof loadEscalas === 'function') {
            loadEscalas();
        }
    }

    async function loadUser() {
        try {
            const response = await authFetch(`${API_BASE}/auth/user`);
            const user = await response.json();

            if (response.ok) {
                const userNameElement = document.getElementById('userName');
                if (userNameElement) {
                    userNameElement.textContent = user.name;
                }
            } else {
                logout();
            }
        } catch (err) {
            console.error('Erro ao carregar usuário:', err);
            logout();
        }
    }

    // ⏱️ Rate limit
    function startCountdown(seconds) {
        const messageElement = document.getElementById('rateLimitMessage');
        const submitBtn = document.getElementById('submitBtn');

        if (!messageElement || !submitBtn) return;

        messageElement.classList.remove('hidden');
        submitBtn.disabled = true;

        const interval = setInterval(() => {
            seconds--;
            messageElement.textContent = `Muitas tentativas. Tente em ${seconds}s`;

            if (seconds <= 0) {
                clearInterval(interval);
                messageElement.classList.add('hidden');
                submitBtn.disabled = false;
            }
        }, 1000);
    }

    // 🔐 LOGIN
    const loginForm = document.getElementById('loginForm');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('token', data.token);

                    // 🔥 boa prática: validar token salvando
                    if (!data.token) {
                        throw new Error('Token não recebido');
                    }

                    window.location.href = 'index.html';
                }
                else if (response.status === 429) {
                    startCountdown(data.retryAfter || 60);
                }
                else {
                    alert(data.error || 'Erro ao logar');
                }

            } catch (err) {
                console.error(err);
                alert('Erro no login');
            }
        });
    }

    // 📝 REGISTER
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch(`${API_BASE}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    alert('Cadastro realizado!');
                    window.location.href = 'login.html';
                } else {
                    alert(data.error);
                }
            } catch (err) {
                console.error(err);
                alert('Erro no cadastro');
            }
        });
    }

    // 🚪 LOGOUT
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    function logout() {
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    }
});

// 👁️ Toggle senha
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
}

// 📊 Relatório
async function atualizarRelatorio() {
    const API_BASE = window.location.origin;
    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`${API_BASE}/escalas`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const escalas = await response.json();

        if (response.ok) {
            let escalado = 0;
            let foi = 0;
            let estimado = 0;
            let real = 0;

            escalas.forEach(e => {
                const status = (e.status || '').toLowerCase();

                if (status === 'escalado') {
                    escalado++;
                    estimado += 150; // valor fixo
                } else if (status === 'foi') {
                    foi++;
                    real += 150; // valor fixo
                }
            });

            document.getElementById('escalasCount').textContent = `Escalado: ${escalado}`;
            document.getElementById('baladasCount').textContent = `Baladas: ${foi}`;
            document.getElementById('valorEstimado').textContent = estimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            document.getElementById('valorReal').textContent = real.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
    } catch (err) {
        console.error(err);
    }
}

// 👤 Modal usuário
const openUserModal = document.getElementById('openUserModal');
const userModal = document.getElementById('userModal');
const closeUserModal = document.getElementById('closeUserModal');

if (openUserModal && userModal && closeUserModal) {
    openUserModal.addEventListener('click', async () => {
        const API_BASE = window.location.origin;
        const token = localStorage.getItem('token');

        try {
            const response = await fetch(`${API_BASE}/auth/user`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const user = await response.json();
            console.log("Dados do usuário", user);
            if (response.ok) {
                document.getElementById('modalName').value = user.name || '';
                document.getElementById('modalEmail').value = user.email || '';
                document.getElementById('modalCpf').value = user.cpf || '';

                userModal.classList.remove('hidden');
                document.body.classList.add('overflow-hidden');
            } else {
                alert(user.error);
            }
        } catch (err) {
            console.error(err);
            alert('Erro ao carregar usuário');
        }
    });

    closeUserModal.addEventListener('click', () => {
        userModal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    });
}