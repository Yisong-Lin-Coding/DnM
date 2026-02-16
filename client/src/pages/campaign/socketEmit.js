export function emitWithAck(socket, eventName, payload = {}) {
    return new Promise((resolve) => {
        if (!socket) {
            resolve({ success: false, message: "Socket is not connected" });
            return;
        }

        let didResolve = false;
        const timeout = setTimeout(() => {
            if (didResolve) return;
            didResolve = true;
            resolve({
                success: false,
                message: `No response for event "${eventName}". Server may be outdated or unavailable.`,
            });
        }, 5000);

        socket.emit(eventName, payload, (response) => {
            if (didResolve) return;
            didResolve = true;
            clearTimeout(timeout);
            resolve(response || { success: false, message: "No response from server" });
        });
    });
}
