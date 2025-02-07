function setTheme(mainVar, secondaryVar,accent1,accent2,accent3) {
    const root = document.documentElement;
    root.style.setProperty('--current-main', mainVar);
    root.style.setProperty('--current-secondary', secondaryVar);
    root.style.setProperty('--current-accent1', accent1);
    root.style.setProperty('--current-accent2', accent2);
    root.style.setProperty('--current-accent3', accent3);
}
