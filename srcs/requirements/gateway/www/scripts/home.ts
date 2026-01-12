export function home () {
		const draggableQuartz:	HTMLImageElement = document.getElementById('draggableQuartz') as HTMLImageElement;
		const dragDiv:			HTMLDivElement = document.getElementById('dragDiv') as HTMLDivElement;
		
		if (!draggableQuartz || !dragDiv)
			return ;

		let isDragged: boolean = false;
		let isActivated: boolean = false;
		let offsetY: number = 0;

		draggableQuartz.addEventListener('mousedown', (e) => {
			e.preventDefault();
			isDragged = true;
			offsetY = e.clientY - draggableQuartz.offsetTop;
			draggableQuartz.style.pointerEvents = 'none';
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

			draggableQuartz.style.top = (newY) + 'px';
		});

		document.addEventListener('mouseup', () => {
			isDragged = false;
			draggableQuartz.style.pointerEvents = '';
			if (isActivated) setTimeout(async () => {
				window.location.hash = 'login'
				isActivated = false;
			}, 200);
		});
};