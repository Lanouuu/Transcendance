export function home () {
		const dragDiv:			HTMLDivElement = document.getElementById('dragDiv') as HTMLDivElement;
		const draggableQuartz:	HTMLImageElement = document.getElementById('draggableQuartz') as HTMLImageElement;
		const quartzShadow:		HTMLDivElement = document.getElementById('quartzShadow') as HTMLDivElement;
		
		if (!dragDiv || !draggableQuartz || !quartzShadow)
			return ;

		let isDragged: boolean = false;
		let isActivated: boolean = false;
		let offsetY: number = 0;

		const updateShadow = () => {
			const maxY = dragDiv.clientHeight - draggableQuartz.clientHeight;
			const actualY = draggableQuartz.offsetTop;

			const ratio = actualY / maxY;
			const size = 30 + ratio * 70;
			const opacity = 0.2 + ratio * 0.8;

			quartzShadow.style.width = `${size}px`;
			quartzShadow.style.height = `${size/1.2}px`;
			quartzShadow.style.opacity = `${opacity}`;
		};

		const animate = () => {
			updateShadow();
			requestAnimationFrame(animate);
		};
		animate();

		draggableQuartz.addEventListener('mousedown', (e) => {
			e.preventDefault();
			isDragged = true;
			offsetY = e.clientY - draggableQuartz.offsetTop;

			draggableQuartz.classList.add('cursor-grabbing');
			draggableQuartz.classList.remove('animate-flowtingQuartz');
		});

		document.addEventListener('mousemove', (e) => {
			if (!isDragged) return ;

			let newY = e.clientY - offsetY;
			const maxY = dragDiv.clientHeight - draggableQuartz.clientHeight;
			isActivated = false;

			if (newY > maxY) {
				newY = maxY;
				isActivated = true;
			}
			if (newY < 0) newY = 0;

			draggableQuartz.style.top = `${newY}px`;
		});

		document.addEventListener('mouseup', () => {
			isDragged = false;

			draggableQuartz.classList.remove('cursor-grabbing');
			if (isActivated) setTimeout(async () => {
				window.location.hash = 'login'
				isActivated = false;
			}, 200);
			draggableQuartz.classList.add('animate-flowtingQuartz');
		});
};