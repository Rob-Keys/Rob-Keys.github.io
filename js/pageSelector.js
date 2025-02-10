document.addEventListener('DOMContentLoaded', function() {
    const oval = document.querySelector('.oval-selector');
    const links = document.querySelectorAll('.nav-link');
    const navContainer = document.querySelector('.nav-container');
    const pageLinks = document.querySelector('.page-links');

    function updateOvalPosition(link) {
        requestAnimationFrame(() => {
            const linkRect = link.getBoundingClientRect();
            const containerRect = pageLinks.getBoundingClientRect();

            oval.style.width = `${linkRect.width}px`;
            oval.style.left = `${linkRect.left - containerRect.left}px`;
        });
    }

    function setInitialPosition() {
        const currentPath = window.location.pathname;
        const activeLink = Array.from(links).find(link =>
            link.getAttribute('href') === currentPath
        ) || links[0];

        links.forEach(l => l.classList.remove('active'));
        activeLink.classList.add('active');
        updateOvalPosition(activeLink);
    }

    links.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();

            links.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            updateOvalPosition(this);

            setTimeout(() => {
                window.location.href = this.getAttribute('href');
            }, 300);
        });
    });

    setInitialPosition();
    window.addEventListener('popstate', setInitialPosition);
});