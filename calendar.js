// Helper function to convert numbers to Persian numerals
const toPersianNumerals = (str) => {
    if (str === null || str === undefined) return '';
    const persian = { '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴', '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹' };
    return str.toString().replace(/[0-9]/g, (w) => persian[w]);
};

// Main function to initialize the calendar
export function initializeCalendar() {
    // Ensure moment.js is loaded and configured for Persian
    if (typeof moment === 'undefined' || typeof moment.loadPersian === 'undefined') {
        console.error("Moment.js or Moment-Jalaali is not loaded.");
        return;
    }
    moment.loadPersian({ dialect: 'persian-modern' });
    
    let currentMoment = moment();
    
    // Sample data for events
    const events = {
        '1403/05/14': [{type: 'income', title: 'دریافت حقوق'}, {type: 'project', title: 'شروع پروژه جدید'}],
        '1403/05/22': [{type: 'expense', title: 'پرداخت قبض برق'}],
        '1403/06/01': [{type: 'income', title: 'واریز سود سهام'}]
    };

    // DOM element references
    const calendarGrid = document.getElementById('calendar-grid');
    const monthYearEl = document.getElementById('calendar-month-year');
    const prevMonthBtn = document.getElementById('calendar-prev-month');
    const nextMonthBtn = document.getElementById('calendar-next-month');
    const modalOverlay = document.getElementById('calendar-modal-overlay');
    const closeModalBtn = document.getElementById('close-calendar-modal-btn');
    const mobileWrapper = document.getElementById('mobile-wrapper');

    // Check if essential elements exist
    if (!calendarGrid || !monthYearEl || !prevMonthBtn || !nextMonthBtn || !modalOverlay || !closeModalBtn || !mobileWrapper) {
        console.error("One or more calendar elements are missing from the DOM.");
        return;
    }

    // Function to render the calendar grid for the current month
    const renderCalendar = () => {
        calendarGrid.innerHTML = '';
        monthYearEl.textContent = currentMoment.format('jMMMM jYYYY');
        
        const startOfMonth = currentMoment.clone().startOf('jMonth');
        const endOfMonth = currentMoment.clone().endOf('jMonth');
        
        // Day of the week for the first day of the month (Saturday = 0)
        const startDayOfWeek = (startOfMonth.jDay() + 1) % 7;
        
        // Add empty cells for days before the start of the month
        for (let i = 0; i < startDayOfWeek; i++) {
            calendarGrid.insertAdjacentHTML('beforeend', '<div></div>');
        }

        // Create day cards for the current month
        for (let m = startOfMonth.clone(); m.isSameOrBefore(endOfMonth); m.add(1, 'day')) {
            const dateString = m.format('jYYYY/jMM/jDD');
            const isToday = m.isSame(moment(), 'day');
            
            let eventDotsHTML = '';
            if (events[dateString]) {
                const eventTypes = new Set(events[dateString].map(e => e.type)); // Avoid duplicate dot types
                eventDotsHTML = `<div class="absolute bottom-2 left-0 right-0 flex justify-center items-center gap-1">`;
                eventTypes.forEach(type => {
                    eventDotsHTML += `<div class="event-dot dot-${type}"></div>`;
                });
                eventDotsHTML += `</div>`;
            }

            const dayCardHTML = `
                <div class="calendar-card rounded-xl flex flex-col items-center justify-center aspect-square cursor-pointer relative ${isToday ? 'today' : ''}" data-date="${dateString}">
                    <span class="text-lg font-bold text-gray-800 dark:text-gray-200">${toPersianNumerals(m.jDate())}</span>
                    ${eventDotsHTML}
                </div>`;
            calendarGrid.insertAdjacentHTML('beforeend', dayCardHTML);
        }
    };
    
    // Function to open the details modal for a specific date
    const openModal = (dateString) => {
        const selectedMoment = moment(dateString, 'jYYYY/jMM/jDD');
        document.getElementById('modal-date-full').textContent = selectedMoment.format('jD jMMMM jYYYY');
        document.getElementById('modal-date-weekday').textContent = selectedMoment.format('dddd');
        
        const modalEventsList = document.getElementById('modal-events-list');
        modalEventsList.innerHTML = '';
        if(events[dateString]) {
            events[dateString].forEach(event => {
                 const eventHTML = `<div class="flex items-center gap-3">
                    <div class="w-2 h-2 rounded-full dot-${event.type} flex-shrink-0"></div>
                    <p>${event.title}</p>
                 </div>`;
                 modalEventsList.insertAdjacentHTML('beforeend', eventHTML);
            });
        } else {
            modalEventsList.innerHTML = `<p class="text-white/60">رویدادی برای این روز ثبت نشده است.</p>`;
        }

        mobileWrapper.classList.add('view-calendar-modal');
    };

    // Function to close the details modal
    const closeModal = () => {
        mobileWrapper.classList.remove('view-calendar-modal');
    };

    // --- Event Listeners ---
    prevMonthBtn.addEventListener('click', () => {
        currentMoment.subtract(1, 'jMonth');
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentMoment.add(1, 'jMonth');
        renderCalendar();
    });

    calendarGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.calendar-card');
        if (card && card.dataset.date) {
            openModal(card.dataset.date);
        }
    });

    closeModalBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });

    // Initial render of the calendar
    renderCalendar();
}
