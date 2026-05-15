/* ===== 키오스크 한글 가상 키보드 모듈 (전역 Kkb)
 * 사용법:
 *   1) <link rel="stylesheet" href=".../assets/kiosk-keyboard.css">
 *   2) <script src=".../assets/hangul.min.js"></script>
 *   3) <script src=".../assets/kiosk-keyboard.js"></script>
 *   4) 모달 내부에 <div class="kkb" id="kkb"></div> 배치
 *   5) 닉네임 input 에 readonly inputmode="none" 추가
 *   6) 모달 열 때: Kkb.init(inputEl, { maxLength: 20 })
 *
 * - Hangul.assemble() 로 자모 → 음절 실시간 조합
 * - 한/영 토글, Shift(자동 해제), 백스페이스, 스페이스 지원
 */
(function(){
  var Kkb = {
    inputEl: null,
    buf: [],
    shift: false,
    lang: 'ko',
    maxLength: 20,
    KO: ['ㅂㅈㄷㄱㅅㅛㅕㅑㅐㅔ','ㅁㄴㅇㄹㅎㅗㅓㅏㅣ','ㅋㅌㅊㅍㅠㅜㅡ'],
    KOSHIFT: ['ㅃㅉㄸㄲㅆㅛㅕㅑㅒㅖ','ㅁㄴㅇㄹㅎㅗㅓㅏㅣ','ㅋㅌㅊㅍㅠㅜㅡ'],
    EN: ['qwertyuiop','asdfghjkl','zxcvbnm'],
    NUM: '1234567890',
    init: function(inputEl, opts) {
      opts = opts || {};
      this.inputEl = inputEl;
      this.buf = [];
      this.shift = false;
      this.lang = 'ko';
      this.maxLength = opts.maxLength || parseInt((inputEl && inputEl.getAttribute('maxlength')) || '20', 10) || 20;
      this.hostId = opts.hostId || 'kkb';
      this.render();
      this.updateInput();
    },
    render: function() {
      var host = document.getElementById(this.hostId);
      if (!host) return;
      host.innerHTML = '';
      host.appendChild(this.row(this.NUM.split('')));
      var rows;
      if (this.lang === 'ko') rows = this.shift ? this.KOSHIFT : this.KO;
      else rows = this.shift ? this.EN.map(function(r){return r.toUpperCase();}) : this.EN;
      var self = this;
      rows.forEach(function(r){ host.appendChild(self.row(r.split(''))); });
      var cr = document.createElement('div');
      cr.className = 'kkb-row';
      cr.appendChild(this.key('⇧ Shift', function(){ self.shift = !self.shift; self.render(); }, 'kkb-ctrl' + (this.shift ? ' kkb-active' : '')));
      cr.appendChild(this.key(this.lang === 'ko' ? '한글 / ABC' : 'ABC / 한글', function(){ self.lang = self.lang === 'ko' ? 'en' : 'ko'; self.shift = false; self.render(); }, 'kkb-lang'));
      cr.appendChild(this.key('Space', function(){ self.input(' '); }, 'kkb-space'));
      cr.appendChild(this.key('← 지우기', function(){ self.del(); }, 'kkb-ctrl'));
      host.appendChild(cr);
    },
    row: function(keys) {
      var r = document.createElement('div');
      r.className = 'kkb-row';
      var self = this;
      keys.forEach(function(k){ r.appendChild(self.key(k, function(){ self.input(k); })); });
      return r;
    },
    key: function(label, fn, cls) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'kkb-key ' + (cls || '');
      b.textContent = label;
      b.addEventListener('pointerdown', function(e){ e.preventDefault(); fn(); });
      return b;
    },
    input: function(ch) {
      if (this.assemble().length >= this.maxLength) return;
      this.buf.push(ch);
      if (this.shift) { this.shift = false; this.render(); }
      this.updateInput();
    },
    del: function() {
      this.buf.pop();
      this.updateInput();
    },
    updateInput: function() {
      if (!this.inputEl) return;
      this.inputEl.value = this.assemble();
    },
    assemble: function() {
      if (typeof Hangul === 'undefined') return this.buf.join('');
      var result = '', group = [];
      for (var i = 0; i < this.buf.length; i++) {
        var c = this.buf[i];
        if (this.isJamo(c)) group.push(c);
        else {
          if (group.length) { result += Hangul.assemble(group); group = []; }
          result += c;
        }
      }
      if (group.length) result += Hangul.assemble(group);
      return result;
    },
    isJamo: function(c) {
      if (!c) return false;
      var code = c.charCodeAt(0);
      return code >= 0x3131 && code <= 0x3163;
    }
  };
  window.Kkb = Kkb;
})();
