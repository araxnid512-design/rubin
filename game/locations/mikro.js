// Кластер «mikro» — заготовка (строится помощником). Временно: поле с выходом на юге.
export default {
	id: 'mikro',
	seed: 4400,
	build(ctx) {
		const { M, ground } = ctx;
		ground(132, 132, 0, 0, M.dirt, 6, 0.012);
		return {
			start: [0, 58.5, Math.PI],
			exits: [{ to: null, x0: -3, x1: 3, z0: 61.2, z1: 66, spawn: [0, 58.5, Math.PI], sign: [4, 60, 'Выход'] }],
			groups: [{ at: [0, 0], r: 10, runners: 4 }],
			onRoad: () => false,
		};
	},
};
