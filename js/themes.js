function setTheme(themeName) {
    const root = document.documentElement;
    let theme = themeName;
    root.style.setProperty('--active-main', "var(--" + theme + "-main)");
    root.style.setProperty('--active-secondary', "var(--" + theme + "-secondary)");
    root.style.setProperty('--active-accent1', "var(--" + theme + "-accent1)");
    root.style.setProperty('--active-accent2', "var(--" + theme + "-accent2)");
    root.style.setProperty('--active-accent3', "var(--" + theme + "-accent3)");
}