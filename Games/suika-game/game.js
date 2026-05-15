// 리사이징 함수
function resizeKiosk() {
    var vw = document.documentElement.clientWidth || window.innerWidth;
    var vh = document.documentElement.clientHeight || window.innerHeight;
    var scale = Math.min(vw / 2160, vh / 3840);
    var gr = document.getElementById('gr');
    gr.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
}
window.addEventListener('resize', resizeKiosk);
resizeKiosk();

function showScr(id) {
    document.querySelectorAll('.scr').forEach(s => s.classList.remove('on'));
    document.getElementById(id).classList.add('on');
}

// [원본 게임 시스템 유지]
const FRUITS = [
    { name: 'coin', radius: 80, score: 1, img: 'assets/coin.png' },
    { name: 'rice', radius: 120, score: 3, img: 'assets/rice.png' },
    { name: 'grape', radius: 160, score: 5, img: 'assets/grape.png' },
    { name: 'ginseng', radius: 200, score: 10, img: 'assets/ginseng.png' },
    { name: 'persimmon', radius: 300, score: 15, img: 'assets/persimmon.png' },
    { name: 'apple', radius: 440, score: 25, img: 'assets/apple.png' },
    { name: 'pear', radius: 540, score: 50, img: 'assets/pear.png' },
];

// 키오스크 해상도 배율 
const GAME_WIDTH = 1800;
const GAME_HEIGHT = 2400;
const FRUIT_SCALE = 2.5; 
const GAME_OVER_LINE_Y = 400;

const { Engine, Render, Runner, World, Bodies, Events, Composite } = Matter;
let engine, render, runner, isGameOver, isPaused = false;
let timeLeft = 120;
let score = 0, currentFruitIndicator, nextFruitData, timerInterval = null, disableAction = false, collisionTimeout;

// 이미지 생성 함수
function createFruit(x, y, data) {
    const body = Bodies.circle(x, y, data.radius, {
        label: `fruit_${data.name}`,
        restitution: 0.2,
        friction: 0.5,
        render: {
            sprite: {
                texture: data.img, // 이미지 경로 사용
                xScale: (data.radius * 2) / 1536, // 이미지 원본 크기에 맞춰 조절 (예: 512px 기준)
                yScale: (data.radius * 2) / 1536
            }
        }
    });
    World.add(engine.world, body);
    return body;
}

// 타이머 시작 함수
function startTimer() {
    timeLeft = 120;
    updateTimerDisplay();
    
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        if (isPaused) return; // 일시정지 중에는 시간이 흐르지 않음
        
        timeLeft--;
        updateTimerDisplay();
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            endGame(); // 시간 종료 시 게임 오버
        }
    }, 1000);
}

function updateTimerDisplay() {
    const timerElement = document.getElementById('timer');
    if (timerElement) {
        timerElement.innerText = timeLeft;
    }
}

function initGame() {
    score = 0; isGameOver = false;
    nextFruitData = FRUITS[Math.floor(Math.random() * 4)];
    updateNextHUD(); // HUD 업데이트
    document.getElementById('score').innerText = '0';
    document.getElementById('game-area').innerHTML = '';
    engine = Engine.create();
    render = Render.create({
        element: document.getElementById('game-area'), engine: engine,
        options: { width: GAME_WIDTH, height: GAME_HEIGHT, wireframes: false, background: '#ffffff', pixelRatio: 1 }
    });
    const thickness = 200;
    const ground = Bodies.rectangle(GAME_WIDTH/2, GAME_HEIGHT+thickness/2, GAME_WIDTH, thickness, { isStatic: true, render: { fillStyle: '#1e1e2c' } });
    // const ground = Bodies.rectangle(GAME_WIDTH/2, GAME_HEIGHT - 1500, GAME_WIDTH, thickness, { isStatic: true, render: { fillStyle: '#1e1e2c' } }); //테스트용
    const leftWall = Bodies.rectangle(-thickness/2, GAME_HEIGHT/2, thickness, GAME_HEIGHT, { isStatic: true, render: { fillStyle: '#1e1e2c' } });
    const rightWall = Bodies.rectangle(GAME_WIDTH+thickness/2, GAME_HEIGHT/2, thickness, GAME_HEIGHT, { isStatic: true, render: { fillStyle: '#1e1e2c' } });
    const topLine = Bodies.rectangle(GAME_WIDTH/2, GAME_OVER_LINE_Y, GAME_WIDTH, 5, { isStatic: true, isSensor: true, render: { fillStyle: '#ff4d4d' }, label: 'topLine' });
    Composite.add(engine.world, [ground, leftWall, rightWall, topLine]);
    Render.run(render);
    runner = Runner.create();
    Runner.run(runner, engine);
    Events.on(engine, 'collisionStart', handleCollision);
    setupInputEvents();
    prepareNextFruit();
    startTimer();
}

// 2. HUD의 다음 과일 이미지를 업데이트하는 함수
function updateNextHUD() {
    const nextImg = document.getElementById('next-preview');
    if (nextFruitData) {
        nextImg.src = nextFruitData.img;
    }
}

function handleCollision(event) {
    if (isGameOver) return;
    event.pairs.forEach(pair => {
        const { bodyA, bodyB } = pair;
        if (bodyA.label === 'topLine' || bodyB.label === 'topLine') {
            const fruitBody = bodyA.label === 'topLine' ? bodyB : bodyA;
            if (!fruitBody.isStatic) {
                clearTimeout(collisionTimeout);
                collisionTimeout = setTimeout(() => { if(fruitBody.position.y < GAME_OVER_LINE_Y) endGame(); }, 1500);
            }
            return; // 라인 충돌이면 여기서 종료
        }
        // 2. 과일 병합 로직 (방어적 설계)
        // 두 바디가 모두 과일이고, 라벨이 완벽히 일치하는지 확인
        if (bodyA.label.startsWith('fruit_') && bodyA.label === bodyB.label) {
            
            // 병합 중인 상태라면 무시
            if (bodyA.isMerging || bodyB.isMerging) return;

            // 현재 과일이 FRUITS 배열에서 몇 번째인지 찾기
            const fruitName = bodyA.label.replace('fruit_', '');
            const idx = FRUITS.findIndex(f => f.name === fruitName);

            // 중요: 마지막 단계(수박)인 경우 합치지 않고 로직 종료
            // FRUITS.length - 1 은 수박의 인덱스입니다.
            if (idx === -1 || idx >= FRUITS.length - 1) {
                return; 
            }

            // 여기까지 왔다면 진화 가능한 과일들입니다.
            bodyA.isMerging = true; 
            bodyB.isMerging = true;

            const next = FRUITS[idx + 1];
            const pos = { 
                x: (bodyA.position.x + bodyB.position.x) / 2, 
                y: (bodyA.position.y + bodyB.position.y) / 2 
            };

            // 월드에서 제거
            World.remove(engine.world, [bodyA, bodyB]);

            // 다음 단계 과일 생성
            setTimeout(() => {
                const newFruit = createFruit(pos.x, pos.y, next);
                score += next.score; 
                document.getElementById('score').innerText = score;
            }, 50);
        }
    });
}

// 3. 과일 준비 로직 수정
function prepareNextFruit() {
    if (isGameOver) return;

    // 현재 쏠 과일은 이전의 'nextFruitData'가 됩니다.
    const currentData = nextFruitData;

    // 대기 중인 인디케이터 생성
    currentFruitIndicator = Bodies.circle(GAME_WIDTH / 2, 150, currentData.radius, {
        isStatic: true,
        isSensor: true,
        label: currentData.name,
        render: {
            sprite: {
                texture: currentData.img,
                xScale: (currentData.radius * 2) / 1536,
                yScale: (currentData.radius * 2) / 1536
            }
        }
    });
    World.add(engine.world, currentFruitIndicator);

    // 새롭게 '다음에 나올 과일'을 미리 뽑습니다. (0~4번 인덱스 중 랜덤)
    nextFruitData = FRUITS[Math.floor(Math.random() * 4)];
    updateNextHUD(); // HUD 업데이트
}

function setupInputEvents() {
    const area = document.getElementById('game-area');
    const move = (e) => {
        if (isGameOver || isPaused || !currentFruitIndicator || disableAction) return;
        const rect = area.getBoundingClientRect();
        const src = e.touches ? e.touches[0] : e;
        let x = (src.clientX - rect.left) * (GAME_WIDTH / rect.width);
        const r = currentFruitIndicator.circleRadius;
        x = Math.max(r, Math.min(x, GAME_WIDTH - r));
        Matter.Body.setPosition(currentFruitIndicator, { x: x, y: 150 });
    };
    const drop = () => {
        if (isGameOver || isPaused || !currentFruitIndicator || disableAction) return;
        disableAction = true;
        const data = FRUITS.find(f => f.name === currentFruitIndicator.label);
        createFruit(currentFruitIndicator.position.x, currentFruitIndicator.position.y, data);
        World.remove(engine.world, currentFruitIndicator);
        currentFruitIndicator = null;
        setTimeout(() => { prepareNextFruit(); disableAction = false; }, 800);
    };
    area.onmousemove = move; area.onmousedown = drop;
    area.ontouchmove = (e) => { e.preventDefault(); move(e); }; area.ontouchend = (e) => { e.preventDefault(); drop(); };
}

function endGame() {
    if (isGameOver) return;
    isGameOver = true;
    
    // 타이머 중지
    if (timerInterval) clearInterval(timerInterval);
    
    Runner.stop(runner);
    Render.stop(render);
    
    document.getElementById('finalScore').innerText = score;
    var regBtn = document.getElementById('registerBtn');
    regBtn.disabled = false;
    regBtn.textContent = '점수 등록';
    regBtn.dataset.score = String(score);
    regBtn.dataset.saved = '0';
    showScr('rs');
}

document.getElementById('startBtn').onclick = () => { showScr('gs'); initGame(); };
document.getElementById('againBtn').onclick = () => { showScr('ss'); };

// ===== 점수 등록 (랭킹 DB 전송) =====
var RANKING_API = (location.protocol === 'http:' || location.protocol === 'https:') ? '/api/ranking' : 'http://localhost:3000/api/ranking';
var GAME_INDEX = 6; // 안성 배 만들기 (수박 게임)

function setNickMsg(text, kind) {
    var el = document.getElementById('nickMsg');
    el.textContent = text || '';
    el.className = 'nickmsg' + (kind ? ' ' + kind : '');
}
function openNickModal() {
    var regBtn = document.getElementById('registerBtn');
    if (regBtn.dataset.saved === '1') return;
    var modal = document.getElementById('nickModal');
    var input = document.getElementById('nickInput');
    var saveBtn = document.getElementById('saveBtn');
    var cancelBtn = document.getElementById('cancelBtn');
    var scoreLabel = document.getElementById('modalScore');
    var sv = parseInt(regBtn.dataset.score || '0', 10) || 0;
    scoreLabel.textContent = '내 점수: ' + sv.toLocaleString() + '점';
    input.value = ''; input.disabled = false;
    saveBtn.disabled = false; saveBtn.textContent = '등록';
    cancelBtn.disabled = false;
    setNickMsg('');
    modal.classList.add('on'); modal.setAttribute('aria-hidden', 'false');
    Kkb.init(input);
}
function closeNickModal() {
    var modal = document.getElementById('nickModal');
    modal.classList.remove('on');
    modal.setAttribute('aria-hidden', 'true');
}
function submitScore() {
    var input = document.getElementById('nickInput');
    var saveBtn = document.getElementById('saveBtn');
    var cancelBtn = document.getElementById('cancelBtn');
    var regBtn = document.getElementById('registerBtn');
    var nickname = (input.value || '').trim();
    if (!nickname) { setNickMsg('닉네임을 입력해주세요.', 'err'); return; }
    if (nickname.length > 20) { setNickMsg('닉네임은 20자 이하여야 합니다.', 'err'); return; }
    var sv = parseInt(regBtn.dataset.score || '0', 10) || 0;
    var imageIndex = Math.floor(Math.random() * 15);
    saveBtn.disabled = true; cancelBtn.disabled = true; input.disabled = true;
    setNickMsg('등록 중...', '');
    fetch(RANKING_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname, score: sv, game_index: GAME_INDEX, image_index: imageIndex })
    })
    .then(function(r) { return r.json().then(function(j) { return { ok: r.ok, body: j }; }); })
    .then(function(res) {
        if (!res.ok) {
            var msg = (res.body && res.body.error) ? res.body.error : '등록에 실패했습니다.';
            setNickMsg(msg, 'err');
            saveBtn.disabled = false; cancelBtn.disabled = false; input.disabled = false;
            return;
        }
        var saved = res.body.nickname || nickname;
        if (res.body.tagged) setNickMsg('중복 닉네임이라 "' + saved + '"(으)로 등록되었습니다.', 'warn');
        else setNickMsg('"' + saved + '" 등록 완료!', 'ok');
        regBtn.dataset.saved = '1';
        regBtn.disabled = true;
        regBtn.textContent = '등록 완료';
        setTimeout(closeNickModal, 1400);
    })
    .catch(function(err) {
        console.error('점수 등록 오류:', err);
        setNickMsg('서버에 연결할 수 없습니다.', 'err');
        saveBtn.disabled = false; cancelBtn.disabled = false; input.disabled = false;
    });
}
document.getElementById('nickModal').addEventListener('click', function(e) { if (e.target === this) closeNickModal(); });
document.getElementById('nickInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); submitScore(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeNickModal(); }
});
