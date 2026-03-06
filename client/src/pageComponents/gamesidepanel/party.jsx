import { useState, useEffect, useRef, useMemo, useContext } from "react";
import { Users, MessageCircle, Send, UserPlus, X, Hash } from "lucide-react";
import { useGame } from "../../data/gameContext";
import { SocketContext } from "../../socket.io/context";

export default function PartyPanel({ activeCharacterId, playerID, campaignID }) {
  const { characters, isDM } = useGame();
  const socket = useContext(SocketContext);
  const [chatView, setChatView] = useState("party"); // "party" | "dm" | "group"
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groups, setGroups] = useState([]);
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMembers, setNewGroupMembers] = useState([]);
  const messagesEndRef = useRef(null);

  // Get party members (all players in campaign)
  const partyMembers = useMemo(() => {
    if (!characters || !playerID) return [];
    
    console.log('[PARTY] Building party members from characters:', {
      totalChars: characters.length,
      currentPlayerID: playerID,
      sampleOwnerIds: characters.slice(0, 3).map(c => ({ name: c.name, ownerId: c.ownerId, ownerName: c.ownerName }))
    });
    
    // Get unique player IDs from character ownership
    const memberSet = new Set();
    const memberMap = new Map(); // Store best name for each member
    
    characters.forEach(char => {
      // Try to get owner info from character
      const ownerId = char.ownerId || char.playerId;
      if (ownerId) {
        const normalizedId = String(ownerId);
        memberSet.add(normalizedId);
        
        // Prefer ownerName if available, otherwise use ownerName or character name
        const ownerName = char.ownerName || char.characterOwnerName || "Player";
        if (!memberMap.has(normalizedId) || ownerName !== "Player") {
          memberMap.set(normalizedId, ownerName);
        }
      }
    });
    
    // Filter out current player and build member list
    const members = Array.from(memberSet)
      .filter(id => id !== playerID && String(id) !== String(playerID))
      .map(id => ({
        id: String(id),
        name: memberMap.get(id) || `Player ${String(id).slice(0, 6)}`,
      }));
    
    console.log('[PARTY] Party members found:', members.length, members);
    return members;
  }, [characters, playerID]);

  // Setup socket connection
  useEffect(() => {
    if (!campaignID || !playerID || !socket) return;

    // Join campaign chat room
    socket.emit("chat_join", { campaignID, playerID });

    // Listen for incoming messages
    const handleChatMessage = (data) => {
      setMessages(prev => [...prev, {
        id: data.id || Date.now(),
        from: data.from,
        fromName: data.fromName,
        to: data.to,
        message: data.message,
        timestamp: data.timestamp || Date.now(),
        type: data.type // "party" | "dm" | "group"
      }]);
    };

    // Listen for group updates
    const handleGroupsUpdated = (data) => {
      setGroups(data.groups || []);
    };

    socket.on("chat_message", handleChatMessage);
    socket.on("chat_groups_updated", handleGroupsUpdated);

    // Request existing groups
    socket.emit("chat_get_groups", { campaignID, playerID });

    return () => {
      socket.emit("chat_leave", { campaignID, playerID });
      socket.off("chat_message", handleChatMessage);
      socket.off("chat_groups_updated", handleGroupsUpdated);
    };
  }, [campaignID, playerID, socket]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Filter messages based on current view
  const filteredMessages = useMemo(() => {
    if (chatView === "party") {
      return messages.filter(m => m.type === "party");
    } else if (chatView === "dm" && selectedUser) {
      return messages.filter(m => 
        (m.from === selectedUser.id && m.to.includes(playerID)) ||
        (m.from === playerID && m.to.includes(selectedUser.id))
      );
    } else if (chatView === "group" && selectedGroup) {
      return messages.filter(m => 
        m.type === "group" && m.to.includes(selectedGroup.id)
      );
    }
    return [];
  }, [messages, chatView, selectedUser, selectedGroup, playerID]);

  const sendMessage = () => {
    if (!inputMessage.trim() || !socket) return;

    const messageData = {
      campaignID,
      from: playerID,
      message: inputMessage.trim(),
      timestamp: Date.now()
    };

    if (chatView === "party") {
      messageData.type = "party";
      messageData.to = "all";
    } else if (chatView === "dm" && selectedUser) {
      messageData.type = "dm";
      messageData.to = [selectedUser.id];
    } else if (chatView === "group" && selectedGroup) {
      messageData.type = "group";
      messageData.to = selectedGroup.members;
      messageData.groupId = selectedGroup.id;
    }

    socket.emit("chat_send_message", messageData);
    setInputMessage("");
  };

  const createGroup = () => {
    if (!newGroupName.trim() || newGroupMembers.length === 0 || !socket) return;

    socket.emit("chat_create_group", {
      campaignID,
      creatorId: playerID,
      name: newGroupName.trim(),
      members: [...newGroupMembers, playerID]
    });

    setNewGroupName("");
    setNewGroupMembers([]);
    setShowGroupCreate(false);
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-slate-950">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-700 bg-slate-900/95 p-3">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Users size={18} /> Party Chat
        </h3>
      </div>

      {/* Chat Type Tabs */}
      <div className="flex-shrink-0 flex gap-1 p-2 bg-slate-900/50 border-b border-slate-700/50">
        <button
          onClick={() => { setChatView("party"); setSelectedUser(null); setSelectedGroup(null); }}
          className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
            chatView === "party" 
              ? "bg-slate-700 text-white" 
              : "text-slate-400 hover:text-white hover:bg-slate-800/50"
          }`}
        >
          <Hash size={14} className="inline mr-1" />
          Party
        </button>
        <button
          onClick={() => setChatView("dm")}
          className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
            chatView === "dm" 
              ? "bg-slate-700 text-white" 
              : "text-slate-400 hover:text-white hover:bg-slate-800/50"
          }`}
        >
          <MessageCircle size={14} className="inline mr-1" />
          DMs
        </button>
        <button
          onClick={() => setChatView("group")}
          className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
            chatView === "group" 
              ? "bg-slate-700 text-white" 
              : "text-slate-400 hover:text-white hover:bg-slate-800/50"
          }`}
        >
          <Users size={14} className="inline mr-1" />
          Groups
        </button>
      </div>

      {/* Sidebar for DMs and Groups */}
      {(chatView === "dm" || chatView === "group") && (
        <div className="flex-shrink-0 h-32 border-b border-slate-700 bg-slate-900/30 p-2 overflow-y-auto scrollbar-thin">
          {chatView === "dm" ? (
            <div className="space-y-1">
              {partyMembers.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No other party members</p>
              ) : (
                partyMembers.map(member => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedUser(member)}
                    className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                      selectedUser?.id === member.id 
                        ? "bg-slate-700 text-white" 
                        : "text-slate-300 hover:bg-slate-800/50"
                    }`}
                  >
                    {member.name}
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <button
                onClick={() => setShowGroupCreate(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-slate-300 hover:bg-slate-800/50 transition-colors"
              >
                <UserPlus size={14} />
                Create Group
              </button>
              {groups.map(group => (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroup(group)}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                    selectedGroup?.id === group.id 
                      ? "bg-slate-700 text-white" 
                      : "text-slate-300 hover:bg-slate-800/50"
                  }`}
                >
                  <Hash size={12} className="inline mr-1" />
                  {group.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-3 space-y-2">
        {chatView === "dm" && !selectedUser ? (
          <div className="text-center text-slate-500 text-sm py-8">
            Select a party member to start chatting
          </div>
        ) : chatView === "group" && !selectedGroup ? (
          <div className="text-center text-slate-500 text-sm py-8">
            Select or create a group to start chatting
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="text-center text-slate-500 text-sm py-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          filteredMessages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.from === playerID ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 ${
                  msg.from === playerID
                    ? "bg-blue-600/80 text-white"
                    : "bg-slate-800 text-slate-100"
                }`}
              >
                {msg.from !== playerID && (
                  <div className="text-[10px] font-semibold text-slate-400 mb-0.5">
                    {msg.fromName || "Unknown"}
                  </div>
                )}
                <div className="text-sm break-words">{msg.message}</div>
                <div className="text-[9px] opacity-60 mt-1 text-right">
                  {formatTimestamp(msg.timestamp)}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-slate-700 bg-slate-900/95 p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            placeholder={
              chatView === "party" 
                ? "Message party..." 
                : chatView === "dm" && selectedUser 
                ? `Message ${selectedUser.name}...` 
                : chatView === "group" && selectedGroup
                ? `Message ${selectedGroup.name}...`
                : "Select a chat..."
            }
            disabled={
              (chatView === "dm" && !selectedUser) || 
              (chatView === "group" && !selectedGroup)
            }
            className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={sendMessage}
            disabled={
              !inputMessage.trim() || 
              (chatView === "dm" && !selectedUser) || 
              (chatView === "group" && !selectedGroup)
            }
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Group Create Modal */}
      {showGroupCreate && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-lg border border-slate-700 p-4 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-semibold text-white">Create Group</h4>
              <button
                onClick={() => { setShowGroupCreate(false); setNewGroupName(""); setNewGroupMembers([]); }}
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Group Name</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Enter group name..."
                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">Members</label>
                <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
                  {partyMembers.map(member => (
                    <label
                      key={member.id}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-800/50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={newGroupMembers.includes(member.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewGroupMembers([...newGroupMembers, member.id]);
                          } else {
                            setNewGroupMembers(newGroupMembers.filter(id => id !== member.id));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm text-slate-200">{member.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setShowGroupCreate(false); setNewGroupName(""); setNewGroupMembers([]); }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createGroup}
                  disabled={!newGroupName.trim() || newGroupMembers.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded transition-colors"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
