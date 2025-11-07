document.addEventListener('DOMContentLoaded', () => {
    const apiClient = window.apiClient;
    const app = window.app;

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    const setSubmitting = (form, isSubmitting) => {
        if (!form) return;
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = isSubmitting;
            submitBtn.classList.toggle('is-loading', isSubmitting);
        }
    };

    if (loginForm && apiClient) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const formData = new FormData(loginForm);
            const email = formData.get('email')?.trim();
            const password = formData.get('password')?.trim();

            if (!email || !password) {
                Utils.showToast('Email y contraseña son requeridos.', 'warning');
                return;
            }

            setSubmitting(loginForm, true);

            try {
                const loginResult = await apiClient.login(email, password);
                app?.updateAuthUI(true);
                app?.renderUserProfile?.();
                Utils.showToast('Inicio de sesión exitoso.', 'success');

                const redirectUrl = loginForm.dataset.redirect || 'catalog.html';
                window.location.href = redirectUrl;
            } catch (error) {
                Utils.showToast(error.message || 'No se pudo iniciar sesión.', 'error');
            } finally {
                setSubmitting(loginForm, false);
            }
        });
    }

    if (registerForm && apiClient) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const formData = new FormData(registerForm);
            const userData = {
                first_name: formData.get('first_name')?.trim() || undefined,
                last_name: formData.get('last_name')?.trim() || undefined,
                email: formData.get('email')?.trim(),
                password: formData.get('password')?.trim(),
                phone: formData.get('phone')?.trim() || undefined,
                company: formData.get('company')?.trim() || undefined
            };

            const confirmPassword = formData.get('confirm_password')?.trim();

            if (!userData.email || !userData.password) {
                Utils.showToast('Email y contraseña son requeridos.', 'warning');
                return;
            }

            if (userData.password.length < 6) {
                Utils.showToast('La contraseña debe tener al menos 6 caracteres.', 'warning');
                return;
            }

            if (userData.password !== confirmPassword) {
                Utils.showToast('Las contraseñas no coinciden.', 'warning');
                return;
            }

            setSubmitting(registerForm, true);

            try {
                const registerResult = await apiClient.register(userData);
                app?.updateAuthUI(true);
                app?.renderUserProfile?.();
                Utils.showToast('Registro exitoso. Redirigiendo...', 'success');

                const redirectUrl = registerForm.dataset.redirect || 'catalog.html';
                window.location.href = redirectUrl;
            } catch (error) {
                Utils.showToast(error.message || 'No se pudo completar el registro.', 'error');
            } finally {
                setSubmitting(registerForm, false);
            }
        });
    }
});

