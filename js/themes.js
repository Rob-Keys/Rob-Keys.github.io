function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme); // Set theme attribute
    localStorage.setItem('theme', theme); // Store theme in localStorage
}

document.addEventListener("DOMContentLoaded", () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
});