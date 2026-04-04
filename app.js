/* ═══════════════════════════════════════════════════════════════
   TransformAI - Main Application Logic
   ═══════════════════════════════════════════════════════════════ */

// ─── Storage Helper ───
const Store = {
    get(key) { try { return JSON.parse(localStorage.getItem('transformai_' + key)); } catch { return null; } },
    set(key, val) { localStorage.setItem('transformai_' + key, JSON.stringify(val)); },
    remove(key) { localStorage.removeItem('transformai_' + key); }
};

// ─── State ───
let state = {
    profile: Store.get('profile') || null,
    workoutHistory: Store.get('workoutHistory') || [],
    completedMeals: Store.get('completedMeals') || {},
    weeklyPlan: Store.get('weeklyPlan') || null,
    weekNum: Store.get('weekNum') || 1,
    completedDays: Store.get('completedDays') || {},
    activeWorkout: null,
    timerInterval: null,
    timerSeconds: 0
};

// ─── Calculations ───
function calcBMR(profile) {
    const { age, sex, weight, height } = profile;
    return sex === 'male'
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161;
}

const ACTIVITY_MULT = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, extra: 1.9 };
const ACTIVITY_LABELS = { sedentary: 'Sedentario', light: 'Ligero', moderate: 'Moderado', active: 'Activo', extra: 'Muy activo' };
const GOAL_LABELS = { muscle: 'Ganar Masa Muscular', fat_loss: 'Perder Grasa', recomp: 'Recomposición Corporal' };
const DIET_LABELS = { omnivore: 'Omnívoro', vegetarian: 'Vegetariano', vegan: 'Vegano', keto: 'Keto' };

function calcTDEE(profile) { return calcBMR(profile) * (ACTIVITY_MULT[profile.activity] || 1.2); }

function calcTargetCalories(profile) {
    const tdee = calcTDEE(profile);
    if (profile.goal === 'muscle') return Math.round(tdee + 350);
    if (profile.goal === 'fat_loss') return Math.round(tdee - 450);
    return Math.round(tdee);
}

function calcMacros(profile) {
    const cal = calcTargetCalories(profile);
    const w = profile.weight;
    let protein, fats, carbs;
    if (profile.goal === 'muscle') { protein = Math.round(w * 2.0); fats = Math.round(w * 1.0); }
    else if (profile.goal === 'fat_loss') { protein = Math.round(w * 2.2); fats = Math.round(w * 0.8); }
    else { protein = Math.round(w * 1.8); fats = Math.round(w * 0.9); }
    if (profile.diet === 'keto') { fats = Math.round((cal * 0.7) / 9); protein = Math.round((cal * 0.25) / 4); }
    carbs = Math.round((cal - protein * 4 - fats * 9) / 4);
    if (carbs < 0) carbs = 30;
    return { protein, carbs, fats, calories: cal };
}

// ─── Exercise Database ───
const EXERCISES = {
    chest: [
        { name: 'Press de Banca', sets: 4, reps: 10, weight: 40 },
        { name: 'Press Inclinado Mancuernas', sets: 3, reps: 12, weight: 16 },
        { name: 'Aperturas en Polea', sets: 3, reps: 15, weight: 10 },
        { name: 'Fondos en Paralelas', sets: 3, reps: 10, weight: 0 }
    ],
    back: [
        { name: 'Dominadas', sets: 4, reps: 8, weight: 0 },
        { name: 'Remo con Barra', sets: 4, reps: 10, weight: 40 },
        { name: 'Jalón al Pecho', sets: 3, reps: 12, weight: 35 },
        { name: 'Remo Mancuerna', sets: 3, reps: 12, weight: 18 }
    ],
    legs: [
        { name: 'Sentadilla', sets: 4, reps: 10, weight: 50 },
        { name: 'Prensa de Piernas', sets: 3, reps: 12, weight: 80 },
        { name: 'Extensión de Cuádriceps', sets: 3, reps: 15, weight: 25 },
        { name: 'Curl Femoral', sets: 3, reps: 12, weight: 20 },
        { name: 'Elevación de Gemelos', sets: 4, reps: 15, weight: 30 }
    ],
    shoulders: [
        { name: 'Press Militar', sets: 4, reps: 10, weight: 30 },
        { name: 'Elevaciones Laterales', sets: 3, reps: 15, weight: 8 },
        { name: 'Pájaro con Mancuernas', sets: 3, reps: 12, weight: 8 },
        { name: 'Face Pull', sets: 3, reps: 15, weight: 15 }
    ],
    arms: [
        { name: 'Curl con Barra', sets: 3, reps: 12, weight: 20 },
        { name: 'Press Francés', sets: 3, reps: 12, weight: 15 },
        { name: 'Curl Martillo', sets: 3, reps: 12, weight: 10 },
        { name: 'Extensión Tríceps Polea', sets: 3, reps: 15, weight: 15 }
    ]
};

function generateWeeklyPlan(goal, sex = 'male') {
    const plansMale = {
        muscle: [
            { day: 'Lun', name: 'Pecho y Tríceps', muscles: ['chest', 'arms'], rest: false },
            { day: 'Mar', name: 'Espalda y Bíceps', muscles: ['back', 'arms'], rest: false },
            { day: 'Mié', name: 'Piernas', muscles: ['legs'], rest: false },
            { day: 'Jue', name: 'Descanso', muscles: [], rest: true },
            { day: 'Vie', name: 'Hombros y Brazos', muscles: ['shoulders', 'arms'], rest: false },
            { day: 'Sáb', name: 'Pecho y Espalda', muscles: ['chest', 'back'], rest: false },
            { day: 'Dom', name: 'Descanso activo', muscles: [], rest: true }
        ],
        fat_loss: [
            { day: 'Lun', name: 'Full Body A', muscles: ['chest', 'back', 'legs'], rest: false },
            { day: 'Mar', name: 'Cardio + Core', muscles: [], rest: true },
            { day: 'Mié', name: 'Full Body B', muscles: ['shoulders', 'legs', 'arms'], rest: false },
            { day: 'Jue', name: 'Descanso', muscles: [], rest: true },
            { day: 'Vie', name: 'Full Body C', muscles: ['chest', 'back', 'shoulders'], rest: false },
            { day: 'Sáb', name: 'HIIT + Piernas', muscles: ['legs'], rest: false },
            { day: 'Dom', name: 'Descanso', muscles: [], rest: true }
        ],
        recomp: [
            { day: 'Lun', name: 'Tren Superior', muscles: ['chest', 'back', 'shoulders'], rest: false },
            { day: 'Mar', name: 'Tren Inferior', muscles: ['legs'], rest: false },
            { day: 'Mié', name: 'Descanso', muscles: [], rest: true },
            { day: 'Jue', name: 'Empuje', muscles: ['chest', 'shoulders', 'arms'], rest: false },
            { day: 'Vie', name: 'Tirón', muscles: ['back', 'arms'], rest: false },
            { day: 'Sáb', name: 'Piernas + Core', muscles: ['legs'], rest: false },
            { day: 'Dom', name: 'Descanso', muscles: [], rest: true }
        ]
    };

    const plansFemale = {
        muscle: [
            { day: 'Lun', name: 'Tren Inferior (Glúteos/Isquios)', muscles: ['legs'], rest: false },
            { day: 'Mar', name: 'Tren Superior', muscles: ['back', 'shoulders'], rest: false },
            { day: 'Mié', name: 'Descanso Activo', muscles: [], rest: true },
            { day: 'Jue', name: 'Tren Inferior (Cuádriceps/Glúteos)', muscles: ['legs'], rest: false },
            { day: 'Vie', name: 'Pecho y Brazos', muscles: ['chest', 'arms'], rest: false },
            { day: 'Sáb', name: 'Cuerpo Completo / HIIT', muscles: ['legs', 'back'], rest: false },
            { day: 'Dom', name: 'Descanso', muscles: [], rest: true }
        ],
        fat_loss: [
            { day: 'Lun', name: 'Piernas y Cardio', muscles: ['legs'], rest: false },
            { day: 'Mar', name: 'Tren Superior Ligero', muscles: ['shoulders', 'back'], rest: false },
            { day: 'Mié', name: 'HIIT + Core', muscles: [], rest: true },
            { day: 'Jue', name: 'Descanso', muscles: [], rest: true },
            { day: 'Vie', name: 'Piernas (Énfasis Glúteos)', muscles: ['legs'], rest: false },
            { day: 'Sáb', name: 'Full Body Funcional', muscles: ['legs', 'arms'], rest: false },
            { day: 'Dom', name: 'Descanso / Yoga', muscles: [], rest: true }
        ],
        recomp: [
            { day: 'Lun', name: 'Piernas Pesado', muscles: ['legs'], rest: false },
            { day: 'Mar', name: 'Empuje y Tirón', muscles: ['chest', 'back'], rest: false },
            { day: 'Mié', name: 'Descanso', muscles: [], rest: true },
            { day: 'Jue', name: 'Glúteos y Femoral', muscles: ['legs'], rest: false },
            { day: 'Vie', name: 'Hombros y Core', muscles: ['shoulders'], rest: false },
            { day: 'Sáb', name: 'Full Body', muscles: ['legs', 'back', 'arms'], rest: false },
            { day: 'Dom', name: 'Descanso', muscles: [], rest: true }
        ]
    };

    const basePlans = sex === 'female' ? plansFemale : plansMale;
    const plan = basePlans[goal] || basePlans.muscle;
    const saved = Store.get('exerciseWeights') || {};
    plan.forEach(d => {
        if (!d.rest) {
            d.exercises = [];
            d.muscles.forEach(m => {
                const pool = EXERCISES[m] || [];
                pool.slice(0, m === d.muscles[0] ? 3 : 2).forEach(ex => {
                    const key = ex.name;
                    d.exercises.push({ ...ex, weight: saved[key] || ex.weight });
                });
            });
        }
    });
    return plan;
}

// ─── Meal Plans ───
const MEAL_DB = {
    omnivore: {
        breakfast: [
            { name: 'Avena con plátano y whey', desc: 'Avena 80g, plátano, scoop whey, miel', p: 35, c: 65, f: 8 },
            { name: 'Huevos revueltos con tostada', desc: '3 huevos, 2 tostadas integrales, aguacate', p: 25, c: 40, f: 22 },
            { name: 'Yogur griego con granola', desc: 'Yogur griego 200g, granola 50g, frutos rojos', p: 22, c: 48, f: 12 }
        ],
        lunch: [
            { name: 'Pollo a la plancha con arroz', desc: 'Pechuga 200g, arroz integral 150g, brócoli', p: 50, c: 55, f: 8 },
            { name: 'Salmón con quinoa', desc: 'Salmón 180g, quinoa 120g, espárragos', p: 42, c: 45, f: 18 },
            { name: 'Bowl de carne y batata', desc: 'Ternera magra 180g, batata 200g, verduras', p: 45, c: 52, f: 12 }
        ],
        snack: [
            { name: 'Batido proteico con frutas', desc: 'Whey, leche almendras, plátano, mantequilla maní', p: 30, c: 35, f: 12 },
            { name: 'Manzana con mantequilla de maní', desc: 'Manzana grande, 2 cdas mantequilla maní', p: 8, c: 30, f: 16 }
        ],
        dinner: [
            { name: 'Pavo con verduras salteadas', desc: 'Pechuga pavo 200g, mix verduras, aceite oliva', p: 45, c: 15, f: 10 },
            { name: 'Merluza al horno con patata', desc: 'Merluza 220g, patata 150g, judías verdes', p: 40, c: 35, f: 6 },
            { name: 'Tortilla de claras con ensalada', desc: '5 claras, 1 huevo, espinacas, tomate, arroz', p: 35, c: 30, f: 8 }
        ]
    },
    vegetarian: {
        breakfast: [
            { name: 'Tortitas de avena y claras', desc: 'Avena 80g, 3 claras, plátano, miel', p: 22, c: 60, f: 6 },
        ],
        lunch: [
            { name: 'Bowl de lentejas y huevo', desc: 'Lentejas 180g, 2 huevos, espinacas, quinoa', p: 35, c: 55, f: 14 },
        ],
        snack: [
            { name: 'Yogur con nueces y semillas', desc: 'Yogur griego 200g, mix nueces 30g, chía', p: 20, c: 22, f: 18 },
        ],
        dinner: [
            { name: 'Tofu salteado con arroz', desc: 'Tofu firme 200g, arroz integral, verduras', p: 30, c: 45, f: 12 },
        ]
    },
    vegan: {
        breakfast: [
            { name: 'Smoothie bowl de proteína', desc: 'Proteína vegetal, plátano, espinaca, granola', p: 28, c: 55, f: 10 },
        ],
        lunch: [
            { name: 'Curry de garbanzos', desc: 'Garbanzos 200g, leche coco, arroz integral', p: 22, c: 60, f: 16 },
        ],
        snack: [
            { name: 'Hummus con crudités', desc: 'Hummus 100g, zanahoria, pepino, pan pita', p: 12, c: 35, f: 14 },
        ],
        dinner: [
            { name: 'Tempeh con quinoa y verduras', desc: 'Tempeh 180g, quinoa 120g, brócoli', p: 32, c: 45, f: 14 },
        ]
    },
    keto: {
        breakfast: [
            { name: 'Huevos con aguacate y bacon', desc: '3 huevos, aguacate, 2 tiras bacon', p: 28, c: 6, f: 38 },
        ],
        lunch: [
            { name: 'Ensalada César con pollo', desc: 'Pollo 200g, lechuga romana, parmesano, aderezo', p: 45, c: 8, f: 28 },
        ],
        snack: [
            { name: 'Mix de nueces y queso', desc: 'Nueces 40g, queso curado 30g', p: 14, c: 5, f: 30 },
        ],
        dinner: [
            { name: 'Salmón con mantequilla y espárragos', desc: 'Salmón 200g, mantequilla hierbal, espárragos', p: 40, c: 6, f: 32 },
        ]
    }
};

function generateMealPlan(profile) {
    const diet = profile.diet || 'omnivore';
    const db = MEAL_DB[diet] || MEAL_DB.omnivore;
    const macros = calcMacros(profile);
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const meals = [
        { type: 'Desayuno', time: '08:00', ...pick(db.breakfast) },
        { type: 'Almuerzo', time: '13:00', ...pick(db.lunch) },
        { type: 'Snack', time: '16:30', ...pick(db.snack) },
        { type: 'Cena', time: '20:00', ...pick(db.dinner) }
    ];
    meals.forEach(m => m.cal = m.p * 4 + m.c * 4 + m.f * 9);
    return meals;
}

// ═══════════════════════════════════════════════════════════════
// APP INITIALIZATION
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    // Splash screen timeout
    setTimeout(() => {
        document.getElementById('splash-screen').classList.remove('active');
        if (state.profile) { showMainApp(); }
        else { document.getElementById('onboarding-screen').classList.add('active'); }
    }, 2800);

    initOnboarding();
    initTabs();
    initProfile();
});

// ─── Gamification (Streaks) ───
function calcStreak() {
    const days = state.completedDays || {};
    // A simplified streak calc: Just count total unique workout days for now,
    // or properly count consecutive days.
    // For MVP gamification without complex date parsing of `wX_dY` format, let's just count total completed sessions.
    // A true streak would rely on exact dates, so let's check workoutHistory dates.
    if (!state.workoutHistory || state.workoutHistory.length === 0) return 0;
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    const historyDates = [...new Set(state.workoutHistory.map(w => new Date(w.date).toDateString()))]
                         .map(d => new Date(d));
    historyDates.sort((a,b) => b - a); // Descending

    // Check if they worked out today or yesterday (to keep streak alive)
    let diffDays = Math.floor((currentDate - historyDates[0]) / (1000 * 60 * 60 * 24));
    if (diffDays > 1) return 0; // Streak broken

    streak++;
    for (let i = 1; i < historyDates.length; i++) {
        const diff = Math.floor((historyDates[i - 1] - historyDates[i]) / (1000 * 60 * 60 * 24));
        if (diff === 1) streak++;
        else break;
    }
    return streak;
}

function renderBadges() {
    const streak = calcStreak();
    document.getElementById('streak-days').textContent = streak;
    const badgesContainer = document.getElementById('badges-container');
    if (!badgesContainer) return;
    
    const badges = [
        { req: 1, icon: '🔥', name: 'Primer Paso' },
        { req: 3, icon: '⚡', name: 'En Racha (3d)' },
        { req: 7, icon: '🏆', name: 'Semana Perfecta' },
        { req: 30, icon: '👑', name: 'Rey de Hierro (30d)' }
    ];

    badgesContainer.innerHTML = badges.map(b => `
        <div class="badge-item ${streak >= b.req ? 'unlocked' : 'locked'}" title="${b.name}">
            <div class="badge-icon">${b.icon}</div>
            <div class="badge-name">${b.name}</div>
        </div>
    `).join('');
}

// ─── Onboarding ───
function initOnboarding() {
    let step = 1;
    const totalSteps = 6;
    const data = { allergies: [], unit: 'kg' };

    const updateStep = () => {
        for (let i = 1; i <= totalSteps; i++) {
            document.getElementById(`onboarding-step-${i}`).classList.toggle('active', i === step);
        }
        document.getElementById('onboarding-progress-fill').style.width = `${(step / totalSteps) * 100}%`;
        document.getElementById('onboarding-step-label').textContent = `Paso ${step} de ${totalSteps}`;
        document.getElementById('btn-prev').style.visibility = step === 1 ? 'hidden' : 'visible';
        document.getElementById('btn-next').textContent = step === totalSteps ? '¡Comenzar!' : 'Siguiente';
    };

    // Toggle buttons
    document.getElementById('sex-toggle').addEventListener('click', e => {
        const btn = e.target.closest('.toggle-btn');
        if (!btn) return;
        document.querySelectorAll('#sex-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        data.sex = btn.dataset.value;
    });

    document.getElementById('unit-toggle')?.addEventListener('click', e => {
        const btn = e.target.closest('.unit-btn');
        if (!btn) return;
        document.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        data.unit = btn.dataset.unit;
        document.getElementById('weight-unit-lbl').textContent = `(${data.unit})`;
        const inputW = document.getElementById('input-weight');
        if (data.unit === 'lbs' && inputW.value) inputW.value = (parseFloat(inputW.value) * 2.20462).toFixed(1);
        else if (data.unit === 'kg' && inputW.value) inputW.value = (parseFloat(inputW.value) / 2.20462).toFixed(1);
    });

    // Option cards
    ['activity-options', 'goal-options', 'diet-options'].forEach(id => {
        document.getElementById(id).addEventListener('click', e => {
            const card = e.target.closest('.option-card');
            if (!card) return;
            document.querySelectorAll(`#${id} .option-card`).forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            const key = id.replace('-options', '');
            data[key] = card.dataset.value;
        });
    });

    // Chips (allergies)
    document.getElementById('allergy-chips').addEventListener('click', e => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        if (chip.dataset.value === 'none') {
            document.querySelectorAll('#allergy-chips .chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            data.allergies = [];
        } else {
            document.querySelector('#allergy-chips .chip[data-value="none"]')?.classList.remove('active');
            chip.classList.toggle('active');
            data.allergies = [...document.querySelectorAll('#allergy-chips .chip.active')]
                .map(c => c.dataset.value).filter(v => v !== 'none');
        }
    });

    document.getElementById('btn-next').addEventListener('click', () => {
        // Validation
        if (step === 1) {
            data.name = document.getElementById('input-name').value.trim();
            data.age = parseInt(document.getElementById('input-age').value);
            if (!data.name) return showToast('Escribe tu nombre');
            if (!data.age || !data.sex) return showToast('Completa edad y sexo');
        } else if (step === 2) {
            let w = parseFloat(document.getElementById('input-weight').value);
            if (data.unit === 'lbs') w = w / 2.20462; // Always store internally as KG
            data.weight = w;
            data.height = parseInt(document.getElementById('input-height').value);
            if (!data.weight || !data.height) return showToast('Completa peso y altura');
        } else if (step === 3 && !data.activity) return showToast('Selecciona tu nivel');
        else if (step === 4 && !data.goal) return showToast('Selecciona tu objetivo');
        else if (step === 5 && !data.diet) return showToast('Selecciona tu dieta');

        if (step < totalSteps) { step++; updateStep(); }
        else { completeOnboarding(data); }
    });

    document.getElementById('btn-prev').addEventListener('click', () => {
        if (step > 1) { step--; updateStep(); }
    });
}

function completeOnboarding(data) {
    state.profile = data;
    state.weeklyPlan = generateWeeklyPlan(data.goal, data.sex);
    Store.set('profile', data);
    Store.set('weeklyPlan', state.weeklyPlan);
    document.getElementById('onboarding-screen').classList.remove('active');
    showMainApp();
}

// ─── Main App ───
function showMainApp() {
    document.getElementById('main-app').classList.add('active');
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
    document.getElementById('greeting-text').textContent = greeting + ',';
    document.getElementById('user-name-display').textContent = state.profile.name || 'Usuario';
    
    if (!state.weeklyPlan) state.weeklyPlan = generateWeeklyPlan(state.profile.goal, state.profile.sex);
    updateDashboard();
    renderWeeklyPlan();
    renderNutrition();
    renderProfile();
    renderBadges();
    initUploadSystem();
    initFoodScanner();
    initCoachScanner();
    loadLastSync();
}

// ─── Dashboard ───
function updateDashboard() {
    const macros = calcMacros(state.profile);
    const consumed = getConsumedMacros();
    const calPercent = Math.min((consumed.cal / macros.calories) * 100, 100);
    const workoutsThisWeek = state.workoutHistory.filter(w => isThisWeek(new Date(w.date))).length;
    const stepCount = Store.get('steps') || Math.floor(Math.random() * 6000 + 2000);
    Store.set('steps', stepCount);

    animateRing('ring-cal-progress', calPercent);
    animateRing('ring-work-progress', (workoutsThisWeek / 5) * 100);
    animateRing('ring-steps-progress', (stepCount / 10000) * 100);

    document.getElementById('ring-cal-value').textContent = consumed.cal;
    document.getElementById('ring-work-value').textContent = workoutsThisWeek;
    document.getElementById('ring-steps-value').textContent = stepCount.toLocaleString();

    // Macros bars
    const pPct = Math.min((consumed.protein / macros.protein) * 100, 100);
    const cPct = Math.min((consumed.carbs / macros.carbs) * 100, 100);
    const fPct = Math.min((consumed.fats / macros.fats) * 100, 100);
    document.getElementById('dash-protein-bar').style.width = pPct + '%';
    document.getElementById('dash-carbs-bar').style.width = cPct + '%';
    document.getElementById('dash-fats-bar').style.width = fPct + '%';
    document.getElementById('dash-protein-val').textContent = `${consumed.protein}g / ${macros.protein}g`;
    document.getElementById('dash-carbs-val').textContent = `${consumed.carbs}g / ${macros.carbs}g`;
    document.getElementById('dash-fats-val').textContent = `${consumed.fats}g / ${macros.fats}g`;

    // Today's workout preview
    const todayIdx = (new Date().getDay() + 6) % 7;
    const todayW = state.weeklyPlan[todayIdx];
    document.getElementById('today-workout-name').textContent = todayW ? todayW.name : 'Descanso';
    const previewEl = document.getElementById('today-workout-preview');
    previewEl.innerHTML = '';
    if (todayW && !todayW.rest && todayW.exercises) {
        todayW.exercises.slice(0, 4).forEach(ex => {
            previewEl.innerHTML += `<div class="preview-exercise">
                <span class="preview-exercise-name">${ex.name}</span>
                <span class="preview-exercise-detail">${ex.sets}×${ex.reps}</span>
            </div>`;
        });
    }
    document.getElementById('btn-start-today-workout').onclick = () => {
        if (todayW && !todayW.rest) { switchTab('workout'); startWorkout(todayIdx); }
    };
    document.getElementById('btn-start-today-workout').style.display = (todayW && !todayW.rest) ? '' : 'none';
}

function getConsumedMacros() {
    const today = new Date().toDateString();
    const meals = Store.get('mealPlan') || [];
    const completed = state.completedMeals[today] || [];
    let p = 0, c = 0, f = 0, cal = 0;
    meals.forEach((m, i) => {
        if (completed.includes(i)) { p += m.p; c += m.c; f += m.f; cal += m.cal; }
    });
    return { protein: p, carbs: c, fats: f, cal };
}

function animateRing(id, percent) {
    const el = document.getElementById(id);
    if (!el) return;
    const circumference = 2 * Math.PI * 58;
    const offset = circumference - (percent / 100) * circumference;
    setTimeout(() => { el.style.strokeDashoffset = Math.max(offset, 0); }, 300);
}

// ─── Tabs ───
function initTabs() {
    document.querySelectorAll('.tab-item').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
}

function switchTab(tab) {
    document.querySelectorAll('.tab-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
}

// ─── Weekly Plan ───
function renderWeeklyPlan() {
    const cont = document.getElementById('week-days-container');
    cont.innerHTML = '';
    document.getElementById('workout-week-badge').textContent = `Semana ${state.weekNum}`;
    const todayIdx = (new Date().getDay() + 6) % 7;

    state.weeklyPlan.forEach((day, i) => {
        const isToday = i === todayIdx;
        const isDone = state.completedDays[`w${state.weekNum}_d${i}`];
        let cls = 'day-card';
        if (day.rest) cls += ' rest';
        else if (isDone) cls += ' completed';
        else if (isToday) cls += ' today';

        const card = document.createElement('div');
        card.className = cls;
        card.innerHTML = `
            <div class="day-badge">${day.day}</div>
            <div class="day-info">
                <div class="day-name">${day.name}</div>
                <div class="day-muscles">${day.rest ? 'Recuperación' : (day.exercises||[]).length + ' ejercicios'}</div>
            </div>
            <span class="day-status">${isDone ? '✓ Hecho' : isToday && !day.rest ? 'Hoy' : ''}</span>`;
        if (!day.rest && !isDone) card.onclick = () => startWorkout(i);
        cont.appendChild(card);
    });
}

// ─── Active Workout ───
function startWorkout(dayIndex) {
    const day = state.weeklyPlan[dayIndex];
    if (!day || day.rest) return;

    state.activeWorkout = { dayIndex, exercises: JSON.parse(JSON.stringify(day.exercises)), startTime: Date.now() };
    document.getElementById('workout-plan-view').classList.add('hidden');
    document.getElementById('active-workout-view').classList.remove('hidden');
    document.getElementById('active-workout-title').textContent = day.name;

    // Timer
    state.timerSeconds = 0;
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
        state.timerSeconds++;
        const m = String(Math.floor(state.timerSeconds / 60)).padStart(2, '0');
        const s = String(state.timerSeconds % 60).padStart(2, '0');
        document.getElementById('workout-timer').textContent = `${m}:${s}`;
    }, 1000);

    renderExercises();
    document.getElementById('btn-back-to-plan').onclick = () => endWorkoutView();
    document.getElementById('btn-finish-workout').onclick = () => finishWorkout();
}

function renderExercises() {
    const list = document.getElementById('active-exercises-list');
    list.innerHTML = '';
    state.activeWorkout.exercises.forEach((ex, ei) => {
        let setsHTML = '';
        for (let s = 0; s < ex.sets; s++) {
            setsHTML += `<div class="set-row">
                <span class="set-col-num">${s + 1}</span>
                <div class="set-col-weight"><input class="set-input" type="number" value="${ex.weight}" data-ex="${ei}" data-set="${s}" data-field="weight" placeholder="kg"></div>
                <div class="set-col-reps"><input class="set-input" type="number" value="${ex.reps}" data-ex="${ei}" data-set="${s}" data-field="reps" placeholder="reps"></div>
                <div class="set-col-check"><div class="set-check" data-ex="${ei}" data-set="${s}"></div></div>
            </div>`;
        }
        list.innerHTML += `<div class="exercise-card">
            <div class="exercise-name">${ex.name}</div>
            <div class="exercise-target">${ex.sets} series × ${ex.reps} reps · ${ex.weight}kg</div>
            <div class="sets-table">
                <div class="sets-header">
                    <span class="set-col-num">Set</span>
                    <span class="set-col-weight">Peso (kg)</span>
                    <span class="set-col-reps">Reps</span>
                    <span class="set-col-check">✓</span>
                </div>
                ${setsHTML}
            </div>
        </div>`;
    });

    list.querySelectorAll('.set-check').forEach(ch => {
        ch.addEventListener('click', () => ch.classList.toggle('checked'));
    });
}

function finishWorkout() {
    clearInterval(state.timerInterval);
    const aw = state.activeWorkout;
    if (!aw) return;

    // Calculate volume
    let totalVolume = 0;
    document.querySelectorAll('.set-row').forEach(row => {
        const check = row.querySelector('.set-check');
        if (check && check.classList.contains('checked')) {
            const w = parseFloat(row.querySelector('[data-field="weight"]')?.value) || 0;
            const r = parseInt(row.querySelector('[data-field="reps"]')?.value) || 0;
            totalVolume += w * r;
        }
    });

    const duration = state.timerSeconds;
    const calBurned = Math.round(duration / 60 * 7);
    const m = String(Math.floor(duration / 60)).padStart(2, '0');
    const s = String(duration % 60).padStart(2, '0');

    // Save to history
    const record = {
        date: new Date().toISOString(),
        name: state.weeklyPlan[aw.dayIndex].name,
        duration: `${m}:${s}`,
        volume: totalVolume,
        calories: calBurned
    };
    state.workoutHistory.unshift(record);
    Store.set('workoutHistory', state.workoutHistory);

    // Mark day complete
    state.completedDays[`w${state.weekNum}_d${aw.dayIndex}`] = true;
    Store.set('completedDays', state.completedDays);

    // Progressive overload check
    let overloadApplied = false;
    const saved = Store.get('exerciseWeights') || {};
    aw.exercises.forEach(ex => {
        const allChecked = document.querySelectorAll(`.set-check[data-ex="${aw.exercises.indexOf(ex)}"]`);
        const completedAll = [...allChecked].every(c => c.classList.contains('checked'));
        if (completedAll) {
            saved[ex.name] = (saved[ex.name] || ex.weight) + 2.5;
            overloadApplied = true;
        }
    });
    if (overloadApplied) {
        Store.set('exerciseWeights', saved);
        state.weeklyPlan = generateWeeklyPlan(state.profile.goal);
        Store.set('weeklyPlan', state.weeklyPlan);
    }

    // Show summary modal
    document.getElementById('summary-time').textContent = `${m}:${s}`;
    document.getElementById('summary-volume').textContent = `${totalVolume.toLocaleString()} kg`;
    document.getElementById('summary-calories').textContent = calBurned;
    document.getElementById('overload-notice').style.display = overloadApplied ? 'flex' : 'none';
    document.getElementById('workout-complete-modal').classList.remove('hidden');

    document.getElementById('btn-close-summary').onclick = () => {
        document.getElementById('workout-complete-modal').classList.add('hidden');
        endWorkoutView();
        updateDashboard();
        renderWeeklyPlan();
        renderHistory();
        renderBadges();
    };

    // Social Share
    document.getElementById('btn-share-workout').onclick = () => {
        document.getElementById('workout-complete-modal').classList.add('hidden');
        document.getElementById('social-share-modal').classList.remove('hidden');
        document.getElementById('share-workout-name').textContent = aw.exercises.length + ' Ejercicios Completados';
        document.getElementById('share-time').textContent = `${m}:${s}`;
        document.getElementById('share-cal').textContent = calBurned;
        document.getElementById('share-vol').textContent = totalVolume.toLocaleString();
        
        // Init Camera
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then(stream => {
            const feed = document.getElementById('camera-feed');
            feed.srcObject = stream;
            document.getElementById('camera-container').style.display = 'block';
            document.getElementById('btn-take-photo').style.display = 'block';
            document.getElementById('btn-save-share').style.display = 'none';
            document.getElementById('share-user-photo').style.display = 'none';
        }).catch(err => {
            showToast('No se pudo acceder a la cámara');
        });
    };

    document.getElementById('btn-take-photo').onclick = () => {
        const feed = document.getElementById('camera-feed');
        const canvas = document.createElement('canvas');
        canvas.width = feed.videoWidth; canvas.height = feed.videoHeight;
        canvas.getContext('2d').drawImage(feed, 0, 0);
        document.getElementById('share-user-photo').src = canvas.toDataURL('image/jpeg');
        document.getElementById('share-user-photo').style.display = 'block';
        document.getElementById('camera-container').style.display = 'none';
        document.getElementById('btn-retake-photo').style.display = 'block';
        document.getElementById('btn-save-share').style.display = 'block';
        
        // Stop camera tracks
        const stream = feed.srcObject;
        if(stream) stream.getTracks().forEach(track => track.stop());
    };

    document.getElementById('btn-retake-photo').onclick = () => {
        document.getElementById('btn-share-workout').click(); // Re-trigger flow
        document.getElementById('btn-retake-photo').style.display = 'none';
    };

    document.getElementById('btn-cancel-share').onclick = () => {
        document.getElementById('social-share-modal').classList.add('hidden');
        document.getElementById('btn-close-summary').click();
    };

    document.getElementById('btn-save-share').onclick = () => {
        // En un entorno real, usaría html2canvas para guardar el DIV como imagen.
        showToast('¡Foto guardada en tu galería!');
        setTimeout(() => document.getElementById('btn-cancel-share').click(), 1500);
    };
}

function endWorkoutView() {
    clearInterval(state.timerInterval);
    document.getElementById('active-workout-view').classList.add('hidden');
    document.getElementById('workout-plan-view').classList.remove('hidden');
    state.activeWorkout = null;
}

function renderHistory() {
    const list = document.getElementById('workout-history-list');
    if (state.workoutHistory.length === 0) {
        list.innerHTML = '<div class="empty-state"><span class="empty-icon">📋</span><p>Aún no hay entrenamientos registrados</p></div>';
        return;
    }
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    list.innerHTML = state.workoutHistory.slice(0, 20).map(w => {
        const d = new Date(w.date);
        return `<div class="history-item">
            <div class="history-date"><span class="history-date-day">${d.getDate()}</span><span class="history-date-month">${months[d.getMonth()]}</span></div>
            <div class="history-info"><div class="history-title">${w.name}</div><div class="history-detail">⏱ ${w.duration} · 🔥 ${w.calories} kcal</div></div>
            <div class="history-volume"><span class="history-volume-val">${w.volume.toLocaleString()}</span><span class="history-volume-label">kg vol.</span></div>
        </div>`;
    }).join('');
}

// ─── Nutrition ───
function renderNutrition() {
    const macros = calcMacros(state.profile);
    document.getElementById('cal-target-display').textContent = macros.calories + ' kcal';
    document.getElementById('macro-protein-target').textContent = macros.protein + 'g';
    document.getElementById('macro-carbs-target').textContent = macros.carbs + 'g';
    document.getElementById('macro-fats-target').textContent = macros.fats + 'g';

    let meals = Store.get('mealPlan');
    const today = new Date().toDateString();
    if (!meals || Store.get('mealPlanDate') !== today) {
        meals = generateMealPlan(state.profile);
        Store.set('mealPlan', meals);
        Store.set('mealPlanDate', today);
    }

    const mealsList = document.getElementById('meals-list');
    const completed = state.completedMeals[today] || [];
    mealsList.innerHTML = meals.map((m, i) => {
        const done = completed.includes(i);
        return `<div class="meal-card ${done ? 'completed' : ''}">
            <div class="meal-header"><span class="meal-type">${m.type} · ${m.time}</span><span class="meal-calories">${m.cal} kcal</span></div>
            <div class="meal-name">${m.name}</div>
            <div class="meal-description">${m.desc}</div>
            <div class="meal-macros">
                <span class="meal-macro"><span class="macro-dot protein"></span> ${m.p}g P</span>
                <span class="meal-macro"><span class="macro-dot carbs"></span> ${m.c}g C</span>
                <span class="meal-macro"><span class="macro-dot fats"></span> ${m.f}g G</span>
            </div>
            <button class="meal-complete-btn" data-meal="${i}">${done ? '✓ Completada' : 'Marcar completada'}</button>
        </div>`;
    }).join('');

    mealsList.querySelectorAll('.meal-complete-btn').forEach(btn => {
        btn.addEventListener('click', () => toggleMeal(parseInt(btn.dataset.meal)));
    });

    updateNutritionRing();
}

function toggleMeal(idx) {
    const today = new Date().toDateString();
    if (!state.completedMeals[today]) state.completedMeals[today] = [];
    const arr = state.completedMeals[today];
    const pos = arr.indexOf(idx);
    if (pos > -1) arr.splice(pos, 1); else arr.push(idx);
    Store.set('completedMeals', state.completedMeals);
    renderNutrition();
    updateDashboard();
}

function updateNutritionRing() {
    const macros = calcMacros(state.profile);
    const consumed = getConsumedMacros();
    const pct = Math.min(Math.round((consumed.cal / macros.calories) * 100), 100);
    document.getElementById('cal-percent').textContent = pct + '%';
    const circ = 2 * Math.PI * 34;
    const off = circ - (pct / 100) * circ;
    setTimeout(() => { document.getElementById('nutrition-ring-progress').style.strokeDashoffset = off; }, 200);
}

// ─── Profile ───
function initProfile() {
    document.getElementById('btn-profile').onclick = () => switchTab('profile');
    document.getElementById('btn-reset-profile').onclick = () => {
        if (confirm('¿Reiniciar todo el perfil y datos?')) {
            ['profile','workoutHistory','completedMeals','weeklyPlan','weekNum','completedDays','mealPlan','mealPlanDate','exerciseWeights','steps']
                .forEach(k => Store.remove(k));
            location.reload();
        }
    };
}

function renderProfile() {
    const p = state.profile;
    if (!p) return;
    const wLabel = p.unit === 'lbs' ? (p.weight * 2.20462).toFixed(1) + ' lbs' : p.weight + ' kg';
    document.getElementById('user-name-display').textContent = p.name || 'Usuario';
    document.getElementById('profile-name').textContent = p.name || 'Mi Perfil';
    document.getElementById('profile-goal-label').textContent = GOAL_LABELS[p.goal] || p.goal;
    document.getElementById('profile-age').textContent = p.age;
    document.getElementById('profile-weight').textContent = wLabel;
    document.getElementById('profile-height').textContent = p.height + ' cm';
    document.getElementById('profile-bmr').textContent = Math.round(calcBMR(p)) + ' kcal';
    document.getElementById('profile-tdee').textContent = Math.round(calcTDEE(p)) + ' kcal';
    document.getElementById('profile-cal-target').textContent = calcTargetCalories(p) + ' kcal';
    document.getElementById('profile-diet').textContent = DIET_LABELS[p.diet] || p.diet;
    document.getElementById('profile-activity').textContent = ACTIVITY_LABELS[p.activity] || p.activity;
    document.getElementById('profile-allergies').textContent = p.allergies?.length ? p.allergies.join(', ') : 'Ninguna';
    renderBadges();
    renderHistory();
}

// ─── Food AI Scanner ───
let foodImageData = null;
function initFoodScanner() {
    const fileInput = document.getElementById('food-image-input');
    const dropzone = document.getElementById('food-dropzone');
    const preview = document.getElementById('food-preview');
    const previewImg = document.getElementById('food-preview-img');
    const analyzingState = document.getElementById('food-analyzing-state');

    dropzone?.addEventListener('click', () => fileInput.click());
    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            foodImageData = ev.target.result;
            previewImg.src = foodImageData;
            dropzone.classList.add('hidden');
            preview.classList.remove('hidden');
            analyzingState.classList.remove('hidden');
            
            // Simulating AI Analysis Cloud call
            setTimeout(() => {
                analyzingState.classList.add('hidden');
                document.getElementById('food-results-modal').classList.remove('hidden');
                
                // Dummy values for visual simulation
                document.getElementById('food-ai-name').value = 'Comida detectada (Ej: Pechuga con arroz)';
                document.getElementById('food-ai-cal').value = Math.floor(Math.random() * 300 + 400);
                document.getElementById('food-ai-p').value = Math.floor(Math.random() * 20 + 20);
                document.getElementById('food-ai-c').value = Math.floor(Math.random() * 40 + 30);
                document.getElementById('food-ai-f').value = Math.floor(Math.random() * 15 + 10);
            }, 2500);
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('btn-food-cancel')?.addEventListener('click', () => {
        document.getElementById('food-results-modal').classList.add('hidden');
        preview.classList.add('hidden');
        dropzone.classList.remove('hidden');
        fileInput.value = '';
    });

    document.getElementById('btn-food-confirm')?.addEventListener('click', () => {
        const p = parseInt(document.getElementById('food-ai-p').value) || 0;
        const c = parseInt(document.getElementById('food-ai-c').value) || 0;
        const f = parseInt(document.getElementById('food-ai-f').value) || 0;
        const cal = parseInt(document.getElementById('food-ai-cal').value) || 0;
        const name = document.getElementById('food-ai-name').value || 'Comida Extra';

        const customMeal = { type: 'Comida Extra (IA)', time: new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}), name, desc: 'Escaneo visual con IA', p, c, f, cal };
        
        let meals = Store.get('mealPlan') || [];
        meals.push(customMeal);
        Store.set('mealPlan', meals);
        
        // Auto-complete it
        const today = new Date().toDateString();
        if (!state.completedMeals[today]) state.completedMeals[today] = [];
        state.completedMeals[today].push(meals.length - 1);
        Store.set('completedMeals', state.completedMeals);

        document.getElementById('btn-food-cancel').click();
        showToast('✅ Macros sumados a tu día');
        renderNutrition();
        updateDashboard();
    });
}

// ─── AI Coach Progress Scanner ───
function initCoachScanner() {
    const fileInput = document.getElementById('progress-image-input');
    const dropzone = document.getElementById('progress-dropzone');
    const reportCard = document.getElementById('coach-analysis-card');
    const reportTxt = document.getElementById('coach-report');

    dropzone?.addEventListener('click', () => fileInput.click());
    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        dropzone.innerHTML = `<div class="analyzing-spinner" style="margin:0 auto;"></div><p style="text-align:center; margin-top:10px;">Analizando proporciones, simetría y postura...</p>`;
        
        setTimeout(() => {
            dropzone.classList.add('hidden');
            reportCard.classList.remove('hidden');
            reportTxt.innerHTML = `
                <p><strong>Definición Corporal:</strong> Se observa una ligera mejora en el tren superior frente al último escaneo. Nivel de grasa estimado en base visual: ~${state.profile.sex==='male'?'14%':'22%'}</p>
                <p><strong>Simetría:</strong> Ligero desbalance en el dorsal derecho. Sugiero aumentar ejercicios unilaterales.</p>
                <p><strong>Postura:</strong> Hombros ligeramente adelantados. Se recomendará mayor énfasis en deltoides posterior (Face Pulls).</p>
            `;
        }, 3500);
    });

    document.getElementById('btn-apply-coach-advice')?.addEventListener('click', () => {
        showToast('Plan de entrenamiento actualizado por la IA');
        // Add a face pull dynamically to the first back/shoulder day
        const plan = state.weeklyPlan;
        for (let d of plan) {
            if (!d.rest && (d.muscles.includes('back') || d.muscles.includes('shoulders'))) {
                d.exercises.push({ name: 'Face Pull (Coach Recomendado)', sets: 3, reps: 15, weight: 15 });
                break;
            }
        }
        Store.set('weeklyPlan', plan);
        renderWeeklyPlan();
        setTimeout(()=> {
            reportCard.classList.add('hidden');
            dropzone.classList.remove('hidden');
            dropzone.innerHTML = `<input type="file" id="progress-image-input" accept="image/*" capture="environment" hidden><p class="dropzone-text">+ Tomar/Subir Foto de Progreso</p>`;
            initCoachScanner(); // rebind
        }, 1000);
    });
}

// ─── Visual Training Validation System ───
let uploadedImageData = null;

function initUploadSystem() {
    const fileInput = document.getElementById('watch-image-input');
    const dropzone = document.getElementById('upload-dropzone');
    const preview = document.getElementById('upload-preview');
    const previewImg = document.getElementById('preview-image');
    const analyzingState = document.getElementById('analyzing-state');

    // Click dropzone to trigger file input
    dropzone.addEventListener('click', () => fileInput.click());

    // Handle file selection
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            uploadedImageData = ev.target.result;
            previewImg.src = uploadedImageData;
            dropzone.classList.add('hidden');
            preview.classList.remove('hidden');
            analyzingState.classList.add('hidden');
        };
        reader.readAsDataURL(file);
    });

    // Change image btn
    document.getElementById('btn-change-image').addEventListener('click', () => {
        fileInput.value = '';
        preview.classList.add('hidden');
        dropzone.classList.remove('hidden');
        uploadedImageData = null;
    });

    // Analyze button
    document.getElementById('btn-analyze-image').addEventListener('click', () => analyzeImage());

    // OCR Modal buttons
    document.getElementById('btn-ocr-cancel').addEventListener('click', () => {
        document.getElementById('ocr-results-modal').classList.add('hidden');
    });
    document.getElementById('btn-ocr-confirm').addEventListener('click', () => confirmOcrResults());
}

async function analyzeImage() {
    if (!uploadedImageData) return showToast('Sube una imagen primero');

    const preview = document.getElementById('upload-preview');
    const analyzingState = document.getElementById('analyzing-state');
    const progressFill = document.getElementById('ocr-progress-fill');

    preview.classList.add('hidden');
    analyzingState.classList.remove('hidden');
    progressFill.style.width = '10%';

    try {
        // Check if Tesseract is available
        if (typeof Tesseract !== 'undefined') {
            progressFill.style.width = '25%';
            document.querySelector('.analyzing-text').textContent = 'Cargando motor OCR...';

            const result = await Tesseract.recognize(uploadedImageData, 'eng+spa', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        progressFill.style.width = (25 + m.progress * 65) + '%';
                    }
                }
            });

            progressFill.style.width = '95%';
            document.querySelector('.analyzing-text').textContent = 'Extrayendo datos...';

            const extracted = parseWatchData(result.data.text);
            await new Promise(r => setTimeout(r, 500));
            progressFill.style.width = '100%';

            showOcrResults(extracted);
        } else {
            // Fallback: simulate OCR with reasonable defaults
            await simulateOcrAnalysis(progressFill);
        }
    } catch (err) {
        console.error('OCR Error:', err);
        // Fallback to simulated analysis
        await simulateOcrAnalysis(progressFill);
    }

    analyzingState.classList.add('hidden');
    document.getElementById('upload-dropzone').classList.remove('hidden');
}

async function simulateOcrAnalysis(progressFill) {
    const steps = [
        { pct: 20, text: 'Cargando motor OCR...' },
        { pct: 45, text: 'Procesando imagen...' },
        { pct: 70, text: 'Reconociendo texto...' },
        { pct: 90, text: 'Extrayendo datos...' },
        { pct: 100, text: 'Análisis completo' }
    ];
    for (const step of steps) {
        progressFill.style.width = step.pct + '%';
        document.querySelector('.analyzing-text').textContent = step.text;
        await new Promise(r => setTimeout(r, 600));
    }
    // Simulate extracted data
    const simulated = {
        calories: Math.floor(Math.random() * 200 + 200),
        duration: `${Math.floor(Math.random() * 30 + 30)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
        heartRate: Math.floor(Math.random() * 40 + 110),
        exerciseType: 'Entrenamiento de fuerza'
    };
    showOcrResults(simulated);
}

function parseWatchData(text) {
    const result = { calories: 0, duration: '', heartRate: 0, exerciseType: '' };
    const lines = text.toUpperCase();

    // Calorías: look for numbers near CAL/KCAL/CALORIES/ACTIVE ENERGY
    const calPatterns = [
        /([\d,.]+)\s*(?:KCAL|CAL|CALORIES)/i,
        /(?:ACTIVE\s*ENERGY|ENERG|CALORIAS|QUEMADAS)[:\s]*([\d,.]+)/i,
        /(?:TOTAL)\s*(?:CALORIES)?[:\s]*([\d,.]+)/i
    ];
    for (const pat of calPatterns) {
        const m = lines.match(pat);
        if (m) { result.calories = parseInt(m[1].replace(/[,.]/g, '')); break; }
    }

    // Duration: look for time patterns MM:SS or HH:MM:SS or "XX min"
    const durPatterns = [
        /(\d{1,2}:\d{2}:\d{2})/,
        /(\d{1,2}:\d{2})(?!\d)/,
        /(\d+)\s*(?:MIN|MINUTOS|MINUTES)/i
    ];
    for (const pat of durPatterns) {
        const m = lines.match(pat);
        if (m) {
            result.duration = m[1];
            if (/MIN/i.test(m[0]) && !m[1].includes(':')) result.duration = m[1] + ':00';
            break;
        }
    }

    // Heart rate: look for BPM, FC, heart rate
    const hrPatterns = [
        /(?:AVG|AVERAGE|PROMEDIO|FC|HEART\s*RATE|BPM)[:\s]*(\d{2,3})/i,
        /(\d{2,3})\s*(?:BPM|LPM)/i
    ];
    for (const pat of hrPatterns) {
        const m = lines.match(pat);
        if (m) { result.heartRate = parseInt(m[1]); break; }
    }

    // Exercise type detection
    const typeKeywords = {
        'Entrenamiento de fuerza': /STRENGTH|FUERZA|WEIGHT|PESAS|TRAINING|FUNCTIONAL/i,
        'Correr': /RUN|RUNNING|CARRERA|CORR/i,
        'Caminar': /WALK|CAMINATA|WALKING/i,
        'Ciclismo': /CYCLING|BIKE|BICICL/i,
        'HIIT': /HIIT|HIGH\s*INTENSITY|INTERVAL/i,
        'Yoga': /YOGA|FLEXIBILITY/i,
        'Natación': /SWIM|SWIMMING|NATACI/i,
        'Eliptica': /ELLIPTICAL|ELIPTIC/i
    };
    for (const [type, regex] of Object.entries(typeKeywords)) {
        if (regex.test(lines)) { result.exerciseType = type; break; }
    }
    if (!result.exerciseType) result.exerciseType = 'Entrenamiento general';

    // If no calories found, estimate from duration & HR
    if (!result.calories && result.duration) {
        const mins = parseInt(result.duration.split(':')[0]) || 30;
        result.calories = Math.round(mins * 7.5);
    }
    if (!result.heartRate) result.heartRate = 0;
    if (!result.duration) result.duration = '00:00';

    return result;
}

function showOcrResults(data) {
    document.getElementById('ocr-calories').value = data.calories || '';
    document.getElementById('ocr-duration').value = data.duration || '';
    document.getElementById('ocr-heartrate').value = data.heartRate || '';
    document.getElementById('ocr-exercise-type').value = data.exerciseType || '';
    document.getElementById('ocr-result-thumb').src = uploadedImageData || '';

    // Compare with today's plan
    const todayIdx = (new Date().getDay() + 6) % 7;
    const todayPlan = state.weeklyPlan[todayIdx];
    const matchStatus = document.getElementById('ocr-match-status');
    const nutritionAdjust = document.getElementById('ocr-nutrition-adjust');

    if (todayPlan && !todayPlan.rest) {
        // Check if exercise type matches
        const isStrength = /fuerza|strength|pesas|weight/i.test(data.exerciseType);
        const planIsStrength = todayPlan.muscles && todayPlan.muscles.length > 0;

        if (isStrength && planIsStrength) {
            matchStatus.className = 'ocr-match-status match-success';
            matchStatus.innerHTML = `<span>✅</span><span><strong>¡Coincidencia!</strong> Tu entrenamiento de fuerza coincide con el plan del día: "${todayPlan.name}". Los ejercicios se marcarán como completados.</span>`;
        } else {
            matchStatus.className = 'ocr-match-status match-warning';
            matchStatus.innerHTML = `<span>⚠️</span><span>Tipo detectado: "${data.exerciseType}". Plan del día: "${todayPlan.name}". Se registrará igualmente en tu historial.</span>`;
        }
    } else {
        matchStatus.className = 'ocr-match-status match-info';
        matchStatus.innerHTML = `<span>ℹ️</span><span>Hoy es día de descanso según tu plan. Este entrenamiento se registrará como extra en tu historial.</span>`;
    }

    // Nutrition adjustment check
    const targetCal = calcTargetCalories(state.profile);
    const expectedBurn = 300; // estimated planned burn
    const actualBurn = data.calories || 0;
    const calDiff = actualBurn - expectedBurn;

    if (Math.abs(calDiff) > 80) {
        nutritionAdjust.style.display = 'block';
        if (calDiff > 0 && state.profile.goal === 'muscle') {
            const extraCarbs = Math.round(calDiff / 4);
            nutritionAdjust.innerHTML = `<div class="adjust-title">🍚 Ajuste Nutricional Sugerido</div>
                <p>Quemaste <strong>${calDiff} kcal más</strong> de lo previsto. Para mantener tu surplus calórico y ganar masa muscular, te sugerimos añadir <strong>~${extraCarbs}g de carbohidratos extra</strong> (ej. un plátano con avena o arroz extra).</p>`;
        } else if (calDiff > 0 && state.profile.goal === 'fat_loss') {
            nutritionAdjust.innerHTML = `<div class="adjust-title">🔥 Quema Extra Detectada</div>
                <p>¡Excelente! Quemaste <strong>${calDiff} kcal más</strong> de lo previsto. Tu déficit calórico se ha amplificado. Puedes mantener tu plan actual o añadir un snack proteico.</p>`;
        } else if (calDiff < 0) {
            const reducedCarbs = Math.round(Math.abs(calDiff) / 4);
            nutritionAdjust.innerHTML = `<div class="adjust-title">⚡ Ajuste Recomendado</div>
                <p>Quemaste <strong>${Math.abs(calDiff)} kcal menos</strong> de lo previsto. Considera reducir <strong>~${reducedCarbs}g de carbohidratos</strong> en tu próxima comida para mantener tu balance.</p>`;
        }
    } else {
        nutritionAdjust.style.display = 'none';
    }

    document.getElementById('ocr-results-modal').classList.remove('hidden');
}

function confirmOcrResults() {
    const calories = parseInt(document.getElementById('ocr-calories').value) || 0;
    const duration = document.getElementById('ocr-duration').value || '00:00';
    const heartRate = parseInt(document.getElementById('ocr-heartrate').value) || 0;
    const exerciseType = document.getElementById('ocr-exercise-type').value || 'General';

    // Auto-complete today's exercises if it's a matching strength workout
    const todayIdx = (new Date().getDay() + 6) % 7;
    const todayPlan = state.weeklyPlan[todayIdx];
    const isStrengthMatch = /fuerza|strength|pesas|weight|funcional/i.test(exerciseType) &&
                            todayPlan && !todayPlan.rest && todayPlan.muscles?.length > 0;

    if (isStrengthMatch) {
        // Mark day as completed
        state.completedDays[`w${state.weekNum}_d${todayIdx}`] = true;
        Store.set('completedDays', state.completedDays);

        // Apply progressive overload
        const saved = Store.get('exerciseWeights') || {};
        if (todayPlan.exercises) {
            todayPlan.exercises.forEach(ex => {
                saved[ex.name] = (saved[ex.name] || ex.weight) + 2.5;
            });
            Store.set('exerciseWeights', saved);
            state.weeklyPlan = generateWeeklyPlan(state.profile.goal);
            Store.set('weeklyPlan', state.weeklyPlan);
        }
    }

    // Calculate volume estimate from duration
    const mins = parseInt(duration.split(':')[0]) || 0;
    const estimatedVolume = isStrengthMatch ? Math.round(mins * 45) : 0;

    // Save to workout history
    const record = {
        date: new Date().toISOString(),
        name: isStrengthMatch ? todayPlan.name : exerciseType,
        duration: duration,
        volume: estimatedVolume,
        calories: calories,
        heartRate: heartRate,
        source: 'apple_watch_ocr'
    };
    state.workoutHistory.unshift(record);
    Store.set('workoutHistory', state.workoutHistory);

    // Save last sync data
    Store.set('lastSync', { calories, duration, heartRate, exerciseType, date: new Date().toISOString() });

    // Apply nutrition adjustment if needed
    const targetCal = calcTargetCalories(state.profile);
    const calDiff = calories - 300;
    if (Math.abs(calDiff) > 80) {
        const adjustment = Store.get('nutritionAdjust') || {};
        adjustment[new Date().toDateString()] = { calDiff, applied: true };
        Store.set('nutritionAdjust', adjustment);
    }

    // Close modal and refresh
    document.getElementById('ocr-results-modal').classList.add('hidden');
    loadLastSync();
    updateDashboard();
    renderWeeklyPlan();
    renderHistory();

    // Reset upload area
    uploadedImageData = null;
    document.getElementById('upload-preview').classList.add('hidden');
    document.getElementById('upload-dropzone').classList.remove('hidden');
    document.getElementById('watch-image-input').value = '';

    showToast(isStrengthMatch ? '✅ Entrenamiento validado y ejercicios completados' : '✅ Entrenamiento registrado con éxito');
}

function loadLastSync() {
    const sync = Store.get('lastSync');
    if (sync) {
        document.getElementById('sync-heart-rate').textContent = sync.heartRate || '--';
        document.getElementById('sync-calories').textContent = sync.calories || '--';
        document.getElementById('sync-duration').textContent = sync.duration || '--';
        const d = new Date(sync.date);
        const now = new Date();
        const diffH = Math.round((now - d) / (1000 * 60 * 60));
        document.getElementById('sync-notice').textContent =
            diffH < 1 ? 'Sincronizado hace unos minutos' :
            diffH < 24 ? `Sincronizado hace ${diffH}h` :
            `Última sync: ${d.toLocaleDateString()}`;
    }
}

// ─── Toast ───
function showToast(msg) {
    let toast = document.querySelector('.toast');
    if (!toast) { toast = document.createElement('div'); toast.className = 'toast'; document.body.appendChild(toast); }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// ─── Helpers ───
function isThisWeek(date) {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return date >= start;
}
