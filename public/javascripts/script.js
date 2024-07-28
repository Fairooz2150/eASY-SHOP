// Preloader 
document.addEventListener("DOMContentLoaded", function() {
    // Ensure the preloader is hidden once the page is fully loaded
    window.addEventListener("load", function() {
        const preloader = document.getElementById('preloader');
        preloader.style.display = 'none';
    });
});
