// Funcionalidad para la página de FAQ
document.addEventListener('DOMContentLoaded', () => {
    const faqQuestions = document.querySelectorAll('.faq-question');
    const openChatbotBtn = document.getElementById('openChatbotBtn');

    // Funcionalidad del acordeón
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const faqItem = question.parentElement;
            const isActive = faqItem.classList.contains('active');
            
            // Cerrar todos los demás items
            document.querySelectorAll('.faq-item').forEach(item => {
                if (item !== faqItem) {
                    item.classList.remove('active');
                }
            });
            
            // Toggle del item actual
            faqItem.classList.toggle('active', !isActive);
        });
    });

    // Botón para abrir chatbot
    if (openChatbotBtn && window.chatbot) {
        openChatbotBtn.addEventListener('click', () => {
            window.chatbot.openChatbot();
        });
    }

    // Abrir FAQ específico desde URL hash
    const hash = window.location.hash;
    if (hash) {
        const faqId = hash.replace('#faq-', '');
        const faqItem = document.querySelector(`[data-faq="${faqId}"]`);
        if (faqItem) {
            setTimeout(() => {
                faqItem.click();
                faqItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        }
    }
});

