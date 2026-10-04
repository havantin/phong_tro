import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  X,
  Send,
  User as UserIcon,
  MapPin,
  ChevronRight,
  Code,
  RotateCcw,
  Volume2,
  Mic,
  Phone,
  ThumbsUp,
  ArrowRight,
  Compass,
} from 'lucide-react';
import { api } from '../services/api';
import { Room, StructuredQuery } from '../types';
import { useToast } from '../context/ToastContext';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  structured_query?: StructuredQuery;
  rooms?: Room[];
  created_at: string;
  suggested_chips?: string[];
}

export const FloatingAiChat: React.FC = () => {
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-1',
      sender: 'bot',
      text: 'Chào bạn! Mình là AI Trợ lý Tìm kiếm Phòng trọ Thông minh tại Tỉnh Thái Nguyên 🎓🏡.\n\nBạn là sinh viên trường nào (ICTU, ĐH Kỹ thuật Công nghiệp, ĐH Y Dược...) hoặc đang tìm phòng quanh khu vực nào tại Thái Nguyên?',
      created_at: new Date().toISOString(),
      suggested_chips: [
        'Gần ICTU dưới 2.5 triệu có điều hòa',
        'Gần ĐH Y Dược dưới 3 triệu',
        'Phòng giá rẻ dưới 1.5 triệu',
        'Tư vấn khu trọ đường Z115',
      ],
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [thinkingStep, setThinkingStep] = useState('');
  const [sessionId, setSessionId] = useState<string>(() => `sess-${Date.now()}`);
  const [showJsonFor, setShowJsonFor] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) {
      showToast('Trình duyệt chưa hỗ trợ phát âm giọng nói', 'info');
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text
      .replace(/[*#•_`]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.05;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
    showToast('Đang phát giọng đọc AI tiếng Việt...', 'info');
  };

  const startVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Trình duyệt của bạn chưa hỗ trợ nhận diện giọng nói Web Speech', 'info');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'vi-VN';
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        showToast('Đang lắng nghe... Hãy nói yêu cầu tìm phòng của bạn', 'info');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        showToast(`Đã nhận diện: "${transcript}"`, 'success');
        handleSend(transcript);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, thinkingStep]);

  const determineChips = (query: string, replyText: string): string[] => {
    const lower = query.toLowerCase();
    if (lower.includes('không tốt') || lower.includes('chưa ưng') || lower.includes('tốt hơn')) {
      return [
        '✨ Gợi ý phòng cao cấp hơn (Full nội thất)',
        '💰 Tìm phòng giá rẻ hơn (<1.8tr)',
        '🚶 Cách trường dưới 500m (Đi bộ)',
        '🐱 Cho nuôi thú cưng & giờ tự do',
      ];
    }
    if (lower.includes('ictu')) {
      return [
        '✨ Làm nó tốt hơn / Gợi ý phòng VIP',
        'Dưới 2 triệu rưỡi thôi',
        'Phải có điều hòa và máy giặt',
        'Tư vấn khu trọ đường Z115',
      ];
    }
    return [
      '✨ Tôi chưa ưng lắm, hãy làm nó tốt hơn',
      '💰 Tìm phòng rẻ hơn nữa',
      '❄️ Thêm điều hòa + Nóng lạnh',
      '📍 Xem vị trí trên bản đồ',
    ];
  };

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: query,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setThinkingStep('AI đang phân tích ý định và ngữ cảnh...');

    const timer1 = setTimeout(() => {
      setThinkingStep('Đang truy xuất database phòng trọ Thái Nguyên...');
    }, 400);

    const timer2 = setTimeout(() => {
      setThinkingStep('Đang tính khoảng cách GPS Haversine và Smart Match...');
    }, 800);

    try {
      const res = await api.sendAiChat(query, sessionId);
      setSessionId(res.session_id);

      const dynamicChips = determineChips(query, res.reply_text);

      const botMsg: Message = {
        id: `b-${Date.now()}`,
        sender: 'bot',
        text: res.reply_text,
        structured_query: res.structured_query,
        rooms: res.rooms,
        created_at: new Date().toISOString(),
        suggested_chips: dynamicChips,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'bot',
          text: 'Xin lỗi bạn, kết nối AI đang gián đoạn một chút. Mình đã kết nối lại, bạn hãy thử gửi lại yêu cầu nhé!',
          created_at: new Date().toISOString(),
          suggested_chips: [
            'Tìm phòng gần ICTU dưới 2.5 triệu',
            'Tìm phòng gần ĐH Y Dược',
            'Phòng giá rẻ dưới 1.5 triệu',
          ],
        },
      ]);
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setLoading(false);
      setThinkingStep('');
    }
  };

  const handleResetSession = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    setSessionId(`sess-${Date.now()}`);
    setMessages([
      {
        id: `init-${Date.now()}`,
        sender: 'bot',
        text: 'Đã làm mới toàn bộ ngữ cảnh trò chuyện 🔄. Bạn muốn tìm kiếm phòng trọ tại khu vực nào của Thái Nguyên?',
        created_at: new Date().toISOString(),
        suggested_chips: [
          'Gần ICTU dưới 2.5 triệu có điều hòa',
          'Gần ĐH Kỹ thuật Công nghiệp (TNUT)',
          'Gần Samsung Phổ Yên',
          'Tư vấn đường Z115',
        ],
      },
    ]);
    showToast('Đã làm mới ngữ cảnh hội thoại', 'info');
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white px-4.5 py-3.5 rounded-full shadow-2xl hover:scale-105 hover:shadow-purple-500/40 transition-all duration-300 group"
          title="Trò chuyện với AI Tìm phòng trọ Thái Nguyên"
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 text-yellow-300 animate-spin" style={{ animationDuration: '6s' }} />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-purple-600 animate-pulse" />
          </div>
          <span className="font-bold text-sm tracking-wide">AI Tìm phòng Thái Nguyên</span>
        </button>
      )}

      {/* Floating Chat Window */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-full sm:w-[450px] h-[640px] max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white p-4 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xs">
                <Sparkles className="w-5 h-5 text-yellow-300" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight flex items-center gap-1.5">
                  AI Trợ lý Phòng trọ
                  <span className="bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full uppercase">
                    Thái Nguyên
                  </span>
                </h3>
                <p className="text-[11px] text-purple-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Ghi nhớ ngữ cảnh & Smart Match 0-100%
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleResetSession}
                title="Làm mới cuộc trò chuyện"
                className="p-1.5 text-purple-200 hover:text-white rounded-xl hover:bg-white/10 transition"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (window.speechSynthesis) {
                    window.speechSynthesis.cancel();
                    setIsSpeaking(false);
                  }
                  setIsOpen(false);
                }}
                className="p-1.5 text-purple-200 hover:text-white rounded-xl hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/70">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'bot' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs text-xs font-bold mt-1">
                    AI
                  </div>
                )}

                <div className="max-w-[88%] space-y-2.5">
                  <div
                    className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-tr-xs shadow-purple-600/20'
                        : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs'
                    }`}
                  >
                    <div className="whitespace-pre-line">{msg.text}</div>

                    {msg.sender === 'bot' && (
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => speakText(msg.text)}
                            className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-purple-600 transition"
                            title="Nghe AI đọc phản hồi"
                          >
                            <Volume2 className="w-3.5 h-3.5 text-purple-600" />
                            <span>Đọc</span>
                          </button>

                          {msg.structured_query && (
                            <button
                              type="button"
                              onClick={() => setShowJsonFor(showJsonFor === msg.id ? null : msg.id)}
                              className="inline-flex items-center gap-1 font-bold text-purple-600 hover:text-purple-700 ml-2"
                            >
                              <Code className="w-3 h-3" />
                              {showJsonFor === msg.id ? 'Ẩn JSON' : 'Xem JSON'}
                            </button>
                          )}
                        </div>

                        <span className="text-[10px] text-slate-400 font-mono">
                          {msg.structured_query?.near_location
                            ? `Gần ${msg.structured_query.near_location}`
                            : 'Thái Nguyên'}
                        </span>
                      </div>
                    )}

                    {showJsonFor === msg.id && msg.structured_query && (
                      <pre className="mt-2.5 p-2.5 bg-slate-900 text-emerald-400 rounded-xl text-[10px] overflow-x-auto font-mono">
                        {JSON.stringify(msg.structured_query, null, 2)}
                      </pre>
                    )}
                  </div>

                  {/* Matched room cards */}
                  {msg.rooms && msg.rooms.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 px-1">
                        <span className="flex items-center gap-1 text-purple-700">
                          <Sparkles className="w-3.5 h-3.5" />
                          Top phòng phù hợp nhất:
                        </span>
                        <Link
                          to="/rooms"
                          onClick={() => setIsOpen(false)}
                          className="text-purple-600 hover:underline"
                        >
                          Xem tất cả ({msg.rooms.length}) →
                        </Link>
                      </div>

                      {msg.rooms.slice(0, 3).map((r) => (
                        <div
                          key={r.id}
                          className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-purple-400 hover:shadow-md transition-all flex items-center gap-3 group"
                        >
                          <img
                            src={r.images[0]}
                            alt={r.title}
                            className="w-16 h-16 rounded-xl object-cover shrink-0 group-hover:scale-105 transition-transform"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span
                                className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-md ${
                                  (r.match_score || 0) >= 90
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-purple-50 text-purple-700'
                                }`}
                              >
                                {r.match_score ? `${r.match_score}% phù hợp` : 'Phù hợp'}
                              </span>
                              <span className="font-extrabold text-xs text-emerald-600">
                                {(r.price / 1000000).toFixed(1)} tr/th
                              </span>
                            </div>
                            <h4 className="font-bold text-xs text-slate-900 truncate">{r.title}</h4>
                            <p className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              {r.distance_km !== undefined
                                ? `${r.distance_km.toFixed(1)} km đến trường`
                                : r.address}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            <Link
                              to={`/rooms/${r.id}`}
                              onClick={() => setIsOpen(false)}
                              className="p-1.5 bg-purple-50 hover:bg-purple-600 text-purple-700 hover:text-white rounded-lg transition"
                              title="Xem chi tiết phòng"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Link>
                            <a
                              href={`tel:${r.owner_phone}`}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-lg transition"
                              title="Gọi chủ trọ"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Dynamic Follow-up Chips under bot response */}
                  {msg.sender === 'bot' && msg.suggested_chips && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {msg.suggested_chips.map((chip, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(chip)}
                          className="px-2.5 py-1 bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-700 text-[11px] font-semibold rounded-full border border-slate-200/90 shadow-2xs hover:border-purple-300 transition flex items-center gap-1 text-left"
                        >
                          <span>{chip}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs text-xs font-bold mt-1">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2.5 text-xs text-purple-800 font-semibold bg-purple-50/90 p-3 rounded-2xl border border-purple-200 w-fit animate-pulse">
                <Sparkles className="w-4 h-4 animate-spin text-purple-600" />
                <span>{thinkingStep || 'AI đang xử lý yêu cầu tìm phòng...'}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-white border-t border-slate-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isListening
                    ? 'Đang lắng nghe giọng nói...'
                    : 'Nhập: Tìm phòng gần ICTU dưới 2.5 triệu...'
                }
                className="flex-1 py-2 px-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
              />
              <button
                type="button"
                onClick={startVoiceInput}
                className={`p-2.5 rounded-2xl transition shrink-0 ${
                  isListening
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-700'
                }`}
                title="Nói bằng giọng nói tiếng Việt"
              >
                <Mic className="w-4 h-4" />
              </button>
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="p-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40 text-white rounded-2xl transition shadow-md shadow-purple-600/30 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
