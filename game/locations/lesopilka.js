// Кластер «Лесопилка» — ЗАГОТОВКА: ровная площадка с выходами (строится в отдельной работе).

export default {
	id: 'lesopilka',
	seed: 3302,
	build(ctx) {
		const { M, ground } = ctx;
		ground(132, 132, 0, 0, M.dirt, 6, 0.012);
		return {
			exits: [
				{ to: 'dachi', x0: -2.5, x1: 2.5, z0: 61.2, z1: 66, spawn: [0, 58.5, Math.PI], sign: [4, 60.2, '↓ Дачи'] },
				{ to: 'murs', x0: -2.5, x1: 2.5, z0: -66, z1: -61.2, spawn: [0, -58.5, 0], sign: [4, -60.2, '↑ Карьер'] },
			],
			groups: [{ at: [0, -20], r: 8, runners: 3 }],
		};
	},
};
