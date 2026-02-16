export function emitWithAck(socket, eventName, payload = {}) {
    return new Promise((resolve) => {
        if (!socket) {
            resolve({ success: false, message: "Socket is not connected" });
            return;
        }

        socket.emit(eventName, payload, (response) => {
            resolve(response || { success: false, message: "No response from server" });
        });
    });
}
