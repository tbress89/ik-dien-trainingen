document.addEventListener('DOMContentLoaded', () => {
    // State
    let exercises = [];
    let activeFilters = {
        phase: 'Alle',
        type: 'Alle',
        difficulty: 'Alle',
        age: 'Alle'
    };
    let searchQuery = '';

    // English → Dutch translation maps for display
    const TAG_TRANSLATIONS = {
        'Attacking': 'Aanvallen',
        'Defending': 'Verdedigen',
        'Transition to Attack': 'Omschakeling aanval',
        'Transition to Defense': 'Omschakeling verdediging',
        'Warm-up': 'Warming-up',
        'Technical': 'Technisch',
        'Tactical': 'Tactisch',
        'Physical': 'Fysiek',
        'Goalkeeper': 'Keeper',
        'Small-Sided Game': 'Partijvorm',
        'Beginner': 'Beginner',
        'Intermediate': 'Gemiddeld',
        'Advanced': 'Gevorderd'
    };

    function translateTag(tag) {
        return TAG_TRANSLATIONS[tag] || tag;
    }

    // DOM Elements
    const searchInput = document.getElementById('searchInput');
    const filterPhase = document.getElementById('filter-phase');
    const filterType = document.getElementById('filter-type');
    const filterDifficulty = document.getElementById('filter-difficulty');
    const filterAge = document.getElementById('filter-age');
    const exerciseGrid = document.getElementById('exerciseGrid');
    const resultsCount = document.getElementById('resultsCount');
    const activeFiltersContainer = document.getElementById('activeFilters');
    const mobileFilterToggle = document.getElementById('mobileFilterToggle');
    const filterPanel = document.getElementById('filterPanel');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const modalOverlay = document.getElementById('exerciseModal');
    const modalContent = document.getElementById('modalContent');
    const modalClose = document.getElementById('modalClose');

    // Initialization
    async function init() {
        try {
            // First check if data is loaded directly via exercises-data.js (works on file:// without CORS)
            if (window.EXERCISES_DATA && Array.isArray(window.EXERCISES_DATA) && window.EXERCISES_DATA.length > 0) {
                exercises = window.EXERCISES_DATA;
                loadingState.style.display = 'none';
                renderExercises();
                return;
            }

            // Fallback to fetch (for HTTP server environments)
            let response;
            try {
                response = await fetch('../data/exercises.json');
                if (!response.ok) throw new Error('exercises.json niet gevonden');
            } catch (e) {
                response = await fetch('../data/sample-exercises.json');
            }

            if (!response || !response.ok) {
                throw new Error('Kon data niet laden');
            }
            exercises = await response.json();
            
            // Ensure exercises is an array
            if (!Array.isArray(exercises) && exercises.exercises) {
                exercises = exercises.exercises;
            } else if (!Array.isArray(exercises)) {
                exercises = [exercises];
            }

            loadingState.style.display = 'none';
            renderExercises();
        } catch (error) {
            console.error('Error fetching data:', error);
            if (window.EXERCISES_DATA && Array.isArray(window.EXERCISES_DATA) && window.EXERCISES_DATA.length > 0) {
                exercises = window.EXERCISES_DATA;
                loadingState.style.display = 'none';
                renderExercises();
            } else {
                loadingState.textContent = 'Fout bij het laden van de gegevens. Zorg ervoor dat data/exercises-data.js of sample-exercises.json beschikbaar is.';
            }
        }
    }

    // Event Listeners
    searchInput.addEventListener('input', debounce((e) => {
        searchQuery = e.target.value.toLowerCase();
        renderExercises();
    }, 300));

    const filterElements = {
        phase: filterPhase,
        type: filterType,
        difficulty: filterDifficulty,
        age: filterAge
    };

    Object.entries(filterElements).forEach(([key, element]) => {
        element.addEventListener('change', (e) => {
            activeFilters[key] = e.target.value;
            renderFilters();
            renderExercises();
        });
    });

    mobileFilterToggle.addEventListener('click', () => {
        filterPanel.classList.toggle('open');
    });

    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
            closeModal();
        }
    });

    // Core Functions
    function renderFilters() {
        activeFiltersContainer.innerHTML = '';
        
        const filterLabels = {
            phase: 'Fase',
            type: 'Type',
            difficulty: 'Niveau',
            age: 'Leeftijd'
        };

        Object.entries(activeFilters).forEach(([key, value]) => {
            if (value !== 'Alle') {
                // Get the Dutch display text from the dropdown option
                const selectEl = filterElements[key];
                const selectedOption = selectEl.querySelector(`option[value="${value}"]`);
                const displayText = selectedOption ? selectedOption.textContent : value;
                
                const pill = document.createElement('div');
                pill.className = 'filter-pill';
                pill.innerHTML = `
                    ${filterLabels[key]}: ${displayText}
                    <button data-key="${key}" aria-label="Verwijder filter">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                `;
                activeFiltersContainer.appendChild(pill);

                // Add click event to remove button
                pill.querySelector('button').addEventListener('click', (e) => {
                    const filterKey = e.currentTarget.getAttribute('data-key');
                    activeFilters[filterKey] = 'Alle';
                    filterElements[filterKey].value = 'Alle';
                    renderFilters();
                    renderExercises();
                });
            }
        });
    }

    function renderExercises() {
        const filtered = exercises.filter(exercise => {
            // Text Search
            const searchMatch = !searchQuery || [
                exercise.title,
                exercise.description,
                exercise.objective,
                exercise.footballAction
            ].some(field => field && field.toLowerCase().includes(searchQuery));

            // Filters
            const phaseMatch = activeFilters.phase === 'Alle' || 
                (exercise.tags && exercise.tags.phaseOfPlay === activeFilters.phase);
            
            const typeMatch = activeFilters.type === 'Alle' || 
                (exercise.tags && exercise.tags.drillType === activeFilters.type);
            
            const difficultyMatch = activeFilters.difficulty === 'Alle' || 
                (exercise.tags && exercise.tags.difficultyLevel === activeFilters.difficulty);
            
            const ageMatch = activeFilters.age === 'Alle' || 
                (exercise.ageGroup && exercise.ageGroup.includes(activeFilters.age));

            return searchMatch && phaseMatch && typeMatch && difficultyMatch && ageMatch;
        });

        // Update UI
        resultsCount.textContent = `${filtered.length} oefening${filtered.length !== 1 ? 'en' : ''} gevonden`;
        
        if (filtered.length === 0) {
            exerciseGrid.innerHTML = '';
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            exerciseGrid.innerHTML = filtered.map(exercise => createCardHTML(exercise)).join('');
            
            // Add click listeners to cards
            document.querySelectorAll('.exercise-card').forEach(card => {
                card.addEventListener('click', () => {
                    const id = card.getAttribute('data-id');
                    const exercise = exercises.find(e => e.id === id);
                    if (exercise) openModal(exercise);
                });
            });
        }
    }

    function createCardHTML(exercise) {
        const imageUrl = exercise.media && exercise.media.images && exercise.media.images.length > 0 
            ? exercise.media.images[0] 
            : null;
            
        const isIndoor = (exercise.title && exercise.title.toLowerCase().includes('zaal')) || (imageUrl && imageUrl.toLowerCase().includes('zaal'));
        const imageBgColor = isIndoor ? '#4DC5E6' : '#6BC294';

        const imageHTML = imageUrl 
            ? `<img src="${imageUrl}" alt="${exercise.title}" class="card-image" style="background-color: ${imageBgColor};">` 
            : `<div class="card-image-placeholder" style="background-color: ${imageBgColor}; color: white;">Geen afbeelding</div>`;

        const tagsHTML = exercise.tags ? `
            <div class="card-tags">
                ${exercise.tags.phaseOfPlay ? `<span class="tag">${translateTag(exercise.tags.phaseOfPlay)}</span>` : ''}
                ${exercise.tags.drillType ? `<span class="tag">${translateTag(exercise.tags.drillType)}</span>` : ''}
                ${exercise.tags.difficultyLevel ? `<span class="tag">${translateTag(exercise.tags.difficultyLevel)}</span>` : ''}
            </div>
        ` : '';

        const minP = exercise.playerCount ? exercise.playerCount.min : '-';
        const maxP = exercise.playerCount ? exercise.playerCount.max : '-';
        const dur = exercise.durationMinutes || '-';
        const age = exercise.ageGroup ? (exercise.ageGroup.length > 2 ? exercise.ageGroup[0] + ' - ' + exercise.ageGroup[exercise.ageGroup.length-1] : exercise.ageGroup.join(', ')) : '-';

        return `
            <article class="exercise-card" data-id="${exercise.id}">
                ${imageHTML}
                <div class="card-content">
                    <h3 class="card-title">${exercise.title || 'Zonder titel'}</h3>
                    <p class="card-objective">${exercise.objective || 'Geen doelstelling opgegeven'}</p>
                    ${tagsHTML}
                    <div class="card-footer">
                        <div class="footer-item">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                            ${minP}-${maxP} pl.
                        </div>
                        <div class="footer-item">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            ${dur} min
                        </div>
                        <div class="footer-item">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            ${age}
                        </div>
                    </div>
                </div>
            </article>
        `;
    }

    function openModal(exercise) {
        const imageUrl = exercise.media && exercise.media.images && exercise.media.images.length > 0 
            ? exercise.media.images[0] 
            : null;
            
        const isIndoor = (exercise.title && exercise.title.toLowerCase().includes('zaal')) || (imageUrl && imageUrl.toLowerCase().includes('zaal'));
        const imageBgColor = isIndoor ? '#4DC5E6' : '#6BC294';
            
        const heroHTML = `
            <div class="modal-hero-container" style="background-color: ${imageBgColor};">
                ${imageUrl 
                    ? `<img src="${imageUrl}" alt="${exercise.title}" class="modal-hero">` 
                    : `<div class="modal-hero-placeholder">Geen afbeelding</div>`}
            </div>
        `;

        const minP = exercise.playerCount ? exercise.playerCount.min : '-';
        const maxP = exercise.playerCount ? exercise.playerCount.max : '-';
        const length = exercise.fieldDimensions ? exercise.fieldDimensions.length : '-';
        const width = exercise.fieldDimensions ? exercise.fieldDimensions.width : '-';
        const unit = exercise.fieldDimensions ? exercise.fieldDimensions.unit : 'm';

        let content = `
            ${heroHTML}
            <div class="modal-body">
                <h2 class="modal-title">${exercise.title || 'Zonder titel'}</h2>
                <p class="modal-objective">${exercise.objective || ''}</p>
                
                <div class="modal-tags">
                    ${exercise.tags && exercise.tags.phaseOfPlay ? `<span class="tag">${translateTag(exercise.tags.phaseOfPlay)}</span>` : ''}
                    ${exercise.tags && exercise.tags.drillType ? `<span class="tag">${translateTag(exercise.tags.drillType)}</span>` : ''}
                    ${exercise.tags && exercise.tags.difficultyLevel ? `<span class="tag">${translateTag(exercise.tags.difficultyLevel)}</span>` : ''}
                    ${exercise.ageGroup ? exercise.ageGroup.map(age => `<span class="tag" style="background:#ddd;color:#333;">${age}</span>`).join('') : ''}
                </div>

                <div class="modal-meta">
                    <div class="meta-item">
                        <span class="meta-label">Spelers</span>
                        <span class="meta-value">${minP} - ${maxP} spelers</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Duur</span>
                        <span class="meta-value">${exercise.durationMinutes || '-'} min</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Afmetingen</span>
                        <span class="meta-value">${length}x${width} ${unit}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Voetbalhandeling</span>
                        <span class="meta-value">${exercise.footballAction || '-'}</span>
                    </div>
                </div>

                ${exercise.description ? `
                <div class="modal-section">
                    <h3>Bedoeling van de oefening</h3>
                    <div class="modal-purpose-box">
                        ${exercise.purpose && exercise.purpose.length > 0 
                            ? `<ul>${exercise.purpose.map(p => `<li>${p}</li>`).join('')}</ul>`
                            : `<p>${exercise.description.replace(/\n/g, '<br>')}</p>`}
                    </div>
                </div>
                ` : ''}

                ${exercise.gameRules && exercise.gameRules.length > 0 ? `
                <div class="modal-section">
                    <h3>Spelregels & Organisatie</h3>
                    <ul class="modal-rules-list">
                        ${exercise.gameRules.map(rule => `<li>${rule}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}

                ${exercise.coachingPoints && exercise.coachingPoints.length > 0 ? `
                <div class="modal-section modal-section--coaching">
                    <h3>🎯 Aandachtspunten voor de trainer</h3>
                    <ul class="modal-coaching-list">
                        ${exercise.coachingPoints.map(cp => `<li>${cp}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}

                ${exercise.difficultySteps && (exercise.difficultySteps.easier || exercise.difficultySteps.harder) ? `
                <div class="modal-section">
                    <h3>Differentiatie (Makkelijker / Moeilijker)</h3>
                    <div class="difficulty-grid">
                        ${exercise.difficultySteps.easier && exercise.difficultySteps.easier.length > 0 ? `
                            <div class="difficulty-box difficulty-box--easier">
                                <h4>📉 Makkelijker maken</h4>
                                <ul>${exercise.difficultySteps.easier.map(step => `<li>${step}</li>`).join('')}</ul>
                            </div>
                        ` : ''}
                        ${exercise.difficultySteps.harder && exercise.difficultySteps.harder.length > 0 ? `
                            <div class="difficulty-box difficulty-box--harder">
                                <h4>📈 Moeilijker maken</h4>
                                <ul>${exercise.difficultySteps.harder.map(step => `<li>${step}</li>`).join('')}</ul>
                            </div>
                        ` : ''}
                    </div>
                </div>
                ` : ''}

                ${exercise.sourceUrl ? `
                <div class="modal-source">
                    <a href="${exercise.sourceUrl}" target="_blank" rel="noopener noreferrer" class="btn-primary">
                        Bekijk origineel op KNVB Rinus ↗
                    </a>
                </div>
                ` : ''}
            </div>
        `;

        modalContent.innerHTML = content;
        modalOverlay.style.display = 'flex';
        // Small timeout to allow display:flex to apply before adding class for transition
        setTimeout(() => {
            modalOverlay.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }, 10);
    }

    function closeModal() {
        modalOverlay.classList.remove('active');
        document.body.style.overflow = '';
        setTimeout(() => {
            modalOverlay.style.display = 'none';
        }, 300); // Wait for transition
    }

    // Utility: Debounce
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Run
    init();
});
