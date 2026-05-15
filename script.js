// 키오스크 캔버스 기준 해상도 (style.css의 .kiosk-wrapper 크기와 일치)
const KIOSK_WIDTH = 1080;
const KIOSK_HEIGHT = 1920;

// 리사이징 함수: 화면 크기에 맞춰 .kiosk-wrapper 를 비율 유지하며 스케일
function resizeKiosk() {
    var vw = document.documentElement.clientWidth || window.innerWidth;
    var vh = document.documentElement.clientHeight || window.innerHeight;
    var scale = Math.min(vw / KIOSK_WIDTH, vh / KIOSK_HEIGHT);
    var wrapper = document.querySelector('.kiosk-wrapper');
    if (!wrapper) return;
    wrapper.style.transformOrigin = 'center center';
    wrapper.style.transform = 'scale(' + scale + ')';
}

window.addEventListener('resize', resizeKiosk);
window.addEventListener('orientationchange', resizeKiosk);
window.addEventListener('DOMContentLoaded', resizeKiosk);
resizeKiosk();
