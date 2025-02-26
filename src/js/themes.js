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

    // Toggle theme menu visibility
const toggleButton = document.getElementById('themeToggle');
const themeContainer = document.getElementById('themeContainer');

toggleButton.addEventListener('click', function() {
    themeContainer.classList.toggle('show');
    // Update arrow indicator
    toggleButton.innerHTML = themeContainer.classList.contains('show') ?
    'Themes ▲' : 'Themes ▼';
});