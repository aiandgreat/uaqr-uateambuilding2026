// Month is 0-indexed (0=Jan, 6=Jul), so July 3, 2026 is (2026, 6, 3)
// UA Team Building 2026 — July 3, 2026, 8:00 AM
const eventDate = new Date(2026, 6, 3, 8, 0, 0); 


const countdown = setInterval(function() {
    const now = new Date().getTime();
    const distance = eventDate - now;
    
    if (distance < 0) {
        clearInterval(countdown);
        // Safety check if elements exist on page (in case script runs on page without timer)
        const sub = document.querySelector('.countdown-subtitle');
        if(sub) sub.textContent = "Event Started";
        const timerDiv = document.querySelector('.countdown-timer');
        if(timerDiv) timerDiv.style.display = 'none';
        return;
    }
    
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
    
    const elDays = document.getElementById('days');
    if(elDays) {
        elDays.textContent = days.toString().padStart(2, '0');
        document.getElementById('hours').textContent = hours.toString().padStart(2, '0');
        document.getElementById('minutes').textContent = minutes.toString().padStart(2, '0');
        document.getElementById('seconds').textContent = seconds.toString().padStart(2, '0');
    }
}, 1000);