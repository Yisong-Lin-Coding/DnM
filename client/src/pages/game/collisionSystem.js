// c:\Projects\client\src\pages\game\collisionSystem.js
export function getCollisionShape(entity) {
    const isChar = !!entity.position;
    const x = isChar ? (Number(entity.position.x) || 0) : ((Number(entity.x) || 0) + (Number(entity.hitbox?.offsetX) || 0));
    const y = isChar ? (Number(entity.position.y) || 0) : ((Number(entity.y) || 0) + (Number(entity.hitbox?.offsetY) || 0));
    const rotation = Number(entity.rotation) || 0;
    const scale = isChar ? 1 : Math.max(0.1, Number(entity.hitbox?.scale) || 1);
    
    const type = String(entity.hitbox?.type || entity.type || "circle").toLowerCase();
    
    if (type === "circle") {
        const size = Number(entity.size) || 0;
        return {
            type: "circle",
            x, y,
            radius: Math.max(1, size * scale) / 2
        };
    }
    
    let vertices = [];
    if (type === "rect") {
        const w = Math.max(1, (Number(entity.width) || 0) * scale) / 2;
        const h = Math.max(1, (Number(entity.height) || 0) * scale) / 2;
        vertices = [{x:-w,y:-h}, {x:w,y:-h}, {x:w,y:h}, {x:-w,y:h}];
    } else if (type === "triangle") {
        const s = Math.max(1, (Number(entity.size) || 0) * scale) / 2;
        vertices = [{x:0,y:-s}, {x:-s,y:s}, {x:s,y:s}];
    } else {
        const size = Number(entity.size) || 0;
        return { type: "circle", x, y, radius: Math.max(1, size * scale) / 2 };
    }
    
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    const transformed = vertices.map(v => ({
        x: x + (v.x * cos - v.y * sin),
        y: y + (v.x * sin + v.y * cos)
    }));
    
    return { type: "polygon", x, y, vertices: transformed };
}

export function getAxes(shape) {
    const axes = [];
    if (shape.type === "polygon") {
        for (let i = 0; i < shape.vertices.length; i++) {
            const p1 = shape.vertices[i];
            const p2 = shape.vertices[(i + 1) % shape.vertices.length];
            const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
            const len = Math.hypot(edge.x, edge.y);
            if (len > 0.0001) axes.push({ x: -edge.y / len, y: edge.x / len });
        }
    }
    return axes;
}

export function projectShape(shape, axis) {
    if (shape.type === "circle") {
        const dot = shape.x * axis.x + shape.y * axis.y;
        return { min: dot - shape.radius, max: dot + shape.radius };
    } else {
        let min = Infinity, max = -Infinity;
        for (const v of shape.vertices) {
            const dot = v.x * axis.x + v.y * axis.y;
            if (dot < min) min = dot;
            if (dot > max) max = dot;
        }
        return { min, max };
    }
}

export function checkCollision(entityA, entityB) {
    const shapeA = getCollisionShape(entityA);
    const shapeB = getCollisionShape(entityB);
    if (!shapeA || !shapeB) return false;

    const rA = shapeA.type === "circle" ? shapeA.radius : Math.max(...shapeA.vertices.map(v => Math.hypot(v.x - shapeA.x, v.y - shapeA.y)));
    const rB = shapeB.type === "circle" ? shapeB.radius : Math.max(...shapeB.vertices.map(v => Math.hypot(v.x - shapeB.x, v.y - shapeB.y)));
    const dx = shapeA.x - shapeB.x;
    const dy = shapeA.y - shapeB.y;
    if (dx*dx + dy*dy > (rA + rB)**2) return false;

    const axes = [...getAxes(shapeA), ...getAxes(shapeB)];

    if (shapeA.type === "circle" && shapeB.type === "polygon") {
        let closestDistSq = Infinity, closestVert = null;
        for (const v of shapeB.vertices) {
            const d = (v.x - shapeA.x)**2 + (v.y - shapeA.y)**2;
            if (d < closestDistSq) { closestDistSq = d; closestVert = v; }
        }
        if (closestVert) {
            const axis = { x: closestVert.x - shapeA.x, y: closestVert.y - shapeA.y };
            const len = Math.hypot(axis.x, axis.y);
            if (len > 0.0001) axes.push({ x: axis.x / len, y: axis.y / len });
        }
    } else if (shapeB.type === "circle" && shapeA.type === "polygon") {
        let closestDistSq = Infinity, closestVert = null;
        for (const v of shapeA.vertices) {
            const d = (v.x - shapeB.x)**2 + (v.y - shapeB.y)**2;
            if (d < closestDistSq) { closestDistSq = d; closestVert = v; }
        }
        if (closestVert) {
            const axis = { x: closestVert.x - shapeB.x, y: closestVert.y - shapeB.y };
            const len = Math.hypot(axis.x, axis.y);
            if (len > 0.0001) axes.push({ x: axis.x / len, y: axis.y / len });
        }
    } else if (shapeA.type === "circle" && shapeB.type === "circle") {
        return (dx*dx + dy*dy) < (shapeA.radius + shapeB.radius)**2;
    }

    for (const axis of axes) {
        const pA = projectShape(shapeA, axis);
        const pB = projectShape(shapeB, axis);
        if (pA.max < pB.min || pB.max < pA.min) return false;
    }
    return true;
}
