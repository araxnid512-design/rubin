// Игра всегда идёт в горизонтальной ориентации.
// На телефоне по кнопке «Начать» включаем полноэкранный режим и блокируем ориентацию (Android/Chrome).
// Если браузер этого не умеет (iPhone) или телефон держат вертикально с выключенным автоповоротом —
// поворачиваем всю игру (#app) на 90° средствами CSS, и она остаётся горизонтальной.

const app = document.getElementById('app');
const isTouch = matchMedia('(pointer: coarse)').matches;

/** Логический размер игры (всегда ширина ≥ высоты на телефоне) и признак CSS-поворота. */
export const view = { w: innerWidth, h: innerHeight, rotated: false };
const listeners = [];
export const onResize = (fn) => listeners.push(fn);

function layout() {
	const w = innerWidth, h = innerHeight;
	view.rotated = isTouch && h > w;
	view.w = view.rotated ? h : w;
	view.h = view.rotated ? w : h;
	app.style.width = `${view.w}px`;
	app.style.height = `${view.h}px`;
	// поворот по часовой стрелке: верх игры у правого края — телефон поворачивают против часовой
	app.style.transform = view.rotated ? `translateX(${w}px) rotate(90deg)` : '';
	document.body.classList.toggle('rotated', view.rotated);
	document.body.classList.toggle('short', view.h < 520);
	for (const fn of listeners) fn(view);
}

/** Точка экрана (clientX/Y) → координаты внутри повёрнутой игры. */
export function toApp(x, y) {
	return view.rotated ? { x: y, y: innerWidth - x } : { x, y };
}

/** Вызывать из обработчика нажатия: полноэкранный режим + горизонтальная ориентация, где поддерживается. */
export async function goLandscape() {
	if (!isTouch) return;
	try {
		if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
	} catch { /* нет полноэкранного режима — останется CSS-поворот */ }
	try {
		await screen.orientation?.lock?.('landscape');
	} catch { /* блокировка не поддерживается */ }
	layout();
}

addEventListener('resize', layout);
addEventListener('orientationchange', () => setTimeout(layout, 150));
screen.orientation?.addEventListener?.('change', () => setTimeout(layout, 50));
layout();
