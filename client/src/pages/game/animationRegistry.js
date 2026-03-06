// c:\Projects\client\src\pages\game\animationRegistry.js
export const ANIMATION_REGISTRY = {
    movement: (entity, progress, params) => {
        const { startX, startY, targetX, targetY } = params;
        const x = startX + (targetX - startX) * progress;
        const y = startY + (targetY - startY) * progress;
        return {
            ...entity,
            position: { ...entity.position, x, y },
        };
    },
    attack: (entity, progress, params) => {
        const { targetX, targetY } = params;
        const startX = Number(entity.position?.x) || 0;
        const startY = Number(entity.position?.y) || 0;
        const dx = targetX - startX;
        const dy = targetY - startY;
        const dist = Math.hypot(dx, dy) || 1;
        
        const lungeDist = Math.min(30, dist * 0.4);
        const offset = Math.sin(progress * Math.PI) * lungeDist;
        
        return {
            ...entity,
            position: {
                ...entity.position,
                x: startX + (dx / dist) * offset,
                y: startY + (dy / dist) * offset,
            },
        };
    },
    damage: (entity, progress, params) => {
        const intensity = (1 - progress) * 5;
        const offsetX = (Math.random() - 0.5) * intensity;
        const offsetY = (Math.random() - 0.5) * intensity;
        return { ...entity, position: { ...entity.position, x: (Number(entity.position?.x) || 0) + offsetX, y: (Number(entity.position?.y) || 0) + offsetY } };
    }
};
