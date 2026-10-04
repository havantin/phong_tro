import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Sparkles,
  Send,
  Code,
  MapPin,
  CheckCircle,
  RotateCcw,
  Zap,
  Check,
  X,
  SlidersHorizontal,
  Compass,
  Volume2,
  Mic,
  Phone,
  ArrowRight,
  ChevronRight,
  ThumbsUp,
  AlertCircle,
} from 'lucide-react';
import { api } from '../services/api';
import { Room, StructuredQuery, LocationItem } from '../types';
import { RoomCard } from '../components/RoomCard';
import { LeafletMap } from '../components/LeafletMap';
import { useToast } from '../context/ToastContext';

export const AiSearchPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const initialQuery = searchParams.get('q') || '';

  const [input, setInput] = useState(
    initialQuery ||
      'Tôi là sinh viên ICTU, muốn tìm phòng dưới 2,5 triệu, cách trường dưới 2km, có điều hòa, wifi và chỗ để xe.'
  );
  const [sessionId, setSessionId] = useState<string>(() => `ai-sess-${Date.now()}`);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [reasoningStep, setReasoningStep] = useState<string>('');
  const [structuredQuery, setStructuredQuery] = useState<StructuredQuery | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [matchedRooms, setMatchedRooms] = useState<Room[]>([]);
  const [locationInfo, setLocationInfo] = useState<LocationItem | null>(null);
  const [activeTab, setActiveTab] = useState<'rooms' | 'map' | 'json'>('rooms');
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: 'user' | 'assistant'; text: string; query?: StructuredQuery }>
  >([]);

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
      showToast('Trình duyệt chưa hỗ trợ nhận diện giọng nói Web Speech', 'info');
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
        handleExecuteAiSearch(transcript);
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

  const sampleQueries = [
    'Tôi là sinh viên ICTU, muốn tìm phòng dưới 2,5 triệu, cách trường dưới 2km, có điều hòa, wifi và chỗ để xe.',
    'Tôi chưa ưng lắm, hãy làm nó tốt hơn',
    'ai không tốt',
    'Dưới 2 triệu rưỡi thôi',
    'Phải có điều hòa và máy giặt',
    'Tư vấn khu trọ đường Z115',
    'Tìm phòng gần Đại học Y Dược dưới 3 triệu',
    'Tìm phòng trọ Hà Nội',
  ];

  const handleExecuteAiSearch = async (textToRun?: string) => {
    const text = textToRun || input;
    if (!text.trim() || loading) return;

    setLoading(true);
    setReasoningStep('AI đang phân tích ngôn ngữ tự nhiên tiếng Việt & phân loại ý định...');
    setConversationHistory((prev) => [...prev, { role: 'user', text }]);

    const t1 = setTimeout(() => {
      setReasoningStep('Đang trích xuất thực thể địa điểm Thái Nguyên, ngân sách và tiện nghi...');
    }, 350);

    const t2 = setTimeout(() => {
      setReasoningStep('Đang tính khoảng cách GPS Haversine và điểm Smart Matching (0-100%)...');
    }, 700);

    try {
      const res = await api.sendAiChat(text, sessionId);
      setSessionId(res.session_id);
      setStructuredQuery(res.structured_query);
      setReplyText(res.reply_text);
      setMatchedRooms(res.rooms);
      setLocationInfo(res.location_info || null);
      setConversationHistory((prev) => [
        ...prev,
        { role: 'assistant', text: res.reply_text, query: res.structured_query },
      ]);
      showToast(`Đã chọn lọc ${res.rooms.length} phòng trọ phù hợp nhất`, 'success');
    } catch (err: any) {
      console.error(err);
      setReplyText(
        'Xin lỗi bạn, quá trình kết nối AI đang gián đoạn một chút. Bạn hãy thử lại hoặc dùng bộ lọc danh mục nhé.'
      );
      showToast('Lỗi phân tích AI', 'error');
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setLoading(false);
      setReasoningStep('');
    }
  };

  useEffect(() => {
    handleExecuteAiSearch(
      initialQuery ||
        'Tôi là sinh viên ICTU, muốn tìm phòng dưới 2,5 triệu, cách trường dưới 2km, có điều hòa, wifi và chỗ để xe.'
    );
  }, []);

  const handleReset = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    setSessionId(`ai-sess-${Date.now()}`);
    setStructuredQuery(null);
    setReplyText('');
    setMatchedRooms([]);
    setLocationInfo(null);
    setConversationHistory([]);
    setInput('');
    showToast('Đã làm mới toàn bộ ngữ cảnh tìm kiếm', 'info');
  };

  // Remove a filter chip directly from structuredQuery
  const handleRemoveChip = (type: string, val?: string) => {
    if (!structuredQuery) return;
    let nextMsg = '';
    if (type === 'near_location') {
      nextMsg = 'Tìm phòng tại Thái Nguyên không giới hạn trường học';
    } else if (type === 'max_price') {
      nextMsg = 'Không giới hạn mức giá tối đa';
    } else if (type === 'max_distance_km') {
      nextMsg = 'Mở rộng bán kính không giới hạn khoảng cách';
    } else if (type === 'amenity' && val) {
      nextMsg = `Bỏ tiêu chí ${val}`;
    }
    handleExecuteAiSearch(nextMsg);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner */}
      <div className="max-w-3xl mx-auto text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-purple-50 border border-purple-200 text-purple-800 text-xs font-bold shadow-2xs">
          <Sparkles className="w-4 h-4 text-purple-600 animate-spin" style={{ animationDuration: '4s' }} />
          <span>AI Chatbot Trợ lý Sinh viên Thái Nguyên · Ghi nhớ ngữ cảnh đa lượt</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Tìm phòng trọ bằng Ngôn ngữ tự nhiên AI
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          Nhập câu nói tự nhiên như khi tâm sự cùng bạn bè. AI tự động trích xuất tiêu chí, ghi nhớ ngữ cảnh qua các lượt trò chuyện, tính khoảng cách GPS thực tế và xếp hạng theo điểm phù hợp (Smart Matching 0 - 100%).
        </p>
      </div>

      {/* INPUT CARD */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xl space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleExecuteAiSearch();
          }}
          className="space-y-4"
        >
          <div className="relative">
            <textarea
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isListening
                  ? 'Đang lắng nghe giọng nói... Hãy nói yêu cầu của bạn'
                  : "Nhập yêu cầu: Ví dụ 'Tôi là sinh viên ICTU, muốn tìm phòng dưới 2,5 triệu, cách trường dưới 2km, có điều hòa, wifi và chỗ để xe.'"
              }
              className="w-full p-4 pr-44 bg-slate-50 border border-slate-200 rounded-2xl text-sm sm:text-base text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:bg-white transition"
            />
            <div className="absolute bottom-4 right-4 flex items-center gap-2">
              <button
                type="button"
                onClick={startVoiceInput}
                className={`p-2.5 rounded-xl border transition flex items-center gap-1.5 text-xs font-bold ${
                  isListening
                    ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                    : 'bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-700 border-slate-200'
                }`}
                title="Nói bằng giọng nói tiếng Việt"
              >
                <Mic className="w-4 h-4 text-purple-600" />
                <span className="hidden sm:inline">Giọng nói</span>
              </button>
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-purple-600/30 transition flex items-center gap-1.5"
              >
                {loading ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin text-yellow-300" />
                    <span>Đang phân tích...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Tìm phòng bằng AI</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick preset chips */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600 font-bold">
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-yellow-500" /> Kịch bản mẫu kiểm thử chức năng AI:
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-rose-600 hover:underline flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Làm mới ngữ cảnh
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {sampleQueries.map((query, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    setInput(query);
                    handleExecuteAiSearch(query);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-xl border transition text-left font-medium ${
                    query.includes('tốt hơn') || query.includes('ai không tốt')
                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 font-bold'
                      : query.includes('Hà Nội')
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
                      : 'bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-purple-700 border-slate-200'
                  }`}
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        </form>

        {/* REASONING STEP ANIMATION */}
        {loading && (
          <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 rounded-2xl border border-purple-200 flex items-center gap-3 text-purple-900 text-xs sm:text-sm animate-pulse">
            <Sparkles className="w-5 h-5 text-purple-600 animate-spin shrink-0" />
            <div>
              <p className="font-bold">Đang xử lý quy trình AI Pipeline...</p>
              <p className="text-purple-700 text-xs">{reasoningStep}</p>
            </div>
          </div>
        )}

        {/* AI INSIGHT & CONVERSATIONAL RESPONSE */}
        {replyText && !loading && (
          <div className="p-5 bg-gradient-to-br from-purple-50/80 via-white to-indigo-50/60 rounded-2xl border border-purple-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  AI
                </div>
                <h3 className="font-extrabold text-sm text-slate-900">
                  Phân tích & Lời khuyên từ AI Trợ lý
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => speakText(replyText)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl border border-purple-200 shadow-2xs transition"
                  title="Nghe AI đọc phản hồi"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{isSpeaking ? 'Dừng đọc' : 'Nghe AI đọc'}</span>
                </button>
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {matchedRooms.length} kết quả
                </span>
              </div>
            </div>

            <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-line bg-white/70 p-4 rounded-xl border border-purple-100/80">
              {replyText}
            </div>

            {/* Quick Follow-up Action Chips */}
            <div className="pt-2 flex flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                Gợi ý bước tiếp theo:
              </span>
              <button
                type="button"
                onClick={() => {
                  const q = 'Tôi chưa ưng lắm, hãy làm nó tốt hơn';
                  setInput(q);
                  handleExecuteAiSearch(q);
                }}
                className="text-xs px-2.5 py-1 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-semibold transition"
              >
                ✨ Gợi ý phòng cao cấp hơn (VIP)
              </button>
              <button
                type="button"
                onClick={() => {
                  const q = 'Có phòng nào rẻ hơn nữa không?';
                  setInput(q);
                  handleExecuteAiSearch(q);
                }}
                className="text-xs px-2.5 py-1 rounded-full bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-700 border border-slate-200 font-semibold transition"
              >
                💰 Tìm phòng rẻ hơn nữa
              </button>
              <button
                type="button"
                onClick={() => {
                  const q = 'Tìm phòng cách trường dưới 500m để đi bộ';
                  setInput(q);
                  handleExecuteAiSearch(q);
                }}
                className="text-xs px-2.5 py-1 rounded-full bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-700 border border-slate-200 font-semibold transition"
              >
                🚶 Cách trường dưới 500m (Đi bộ)
              </button>
              <button
                type="button"
                onClick={() => {
                  const q = 'Có phòng nào cho nuôi mèo không?';
                  setInput(q);
                  handleExecuteAiSearch(q);
                }}
                className="text-xs px-2.5 py-1 rounded-full bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-700 border border-slate-200 font-semibold transition"
              >
                🐱 Cho nuôi thú cưng
              </button>
            </div>
          </div>
        )}

        {/* ACTIVE EXTRACTED FILTERS CHIPS */}
        {structuredQuery && (
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1.5 text-purple-700">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Tiêu chí đang áp dụng (Bấm dấu × để bỏ bớt):
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Khu vực: {structuredQuery.province}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {structuredQuery.near_location && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-bold border border-purple-300">
                  <MapPin className="w-3 h-3 text-purple-600" />
                  Gần: {locationInfo ? locationInfo.short_name : structuredQuery.near_location}
                  <button
                    type="button"
                    onClick={() => handleRemoveChip('near_location')}
                    className="hover:text-rose-600 transition ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {structuredQuery.max_price && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
                  Giá: ≤ {(structuredQuery.max_price / 1000000).toFixed(1)} tr/tháng
                  <button
                    type="button"
                    onClick={() => handleRemoveChip('max_price')}
                    className="hover:text-rose-600 transition ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {structuredQuery.max_distance_km && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold border border-blue-300">
                  Khoảng cách: ≤ {structuredQuery.max_distance_km} km
                  <button
                    type="button"
                    onClick={() => handleRemoveChip('max_distance_km')}
                    className="hover:text-rose-600 transition ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {structuredQuery.amenities.map((amenity) => (
                <span
                  key={amenity}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-medium border border-slate-300"
                >
                  <Check className="w-3 h-3 text-emerald-600" />
                  {amenity}
                  <button
                    type="button"
                    onClick={() => handleRemoveChip('amenity', amenity)}
                    className="hover:text-rose-600 transition ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* VIEW TABS & RESULTS CONTAINER */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('rooms')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
                activeTab === 'rooms'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <span>Danh sách phòng ({matchedRooms.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
                activeTab === 'map'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Bản đồ Thái Nguyên</span>
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
                activeTab === 'json'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <Code className="w-4 h-4" />
              <span>Cấu trúc JSON & Trọng số</span>
            </button>
          </div>

          {locationInfo && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 font-medium">
              <MapPin className="w-3.5 h-3.5 text-purple-600" />
              <span>Tâm tìm kiếm: {locationInfo.name}</span>
            </div>
          )}
        </div>

        {/* TAB 1: ROOMS GRID */}
        {activeTab === 'rooms' && (
          <div className="space-y-6">
            {matchedRooms.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {matchedRooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    targetLocationName={locationInfo ? locationInfo.short_name : 'trường học'}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 space-y-4">
                <AlertCircle className="w-12 h-12 text-slate-400 mx-auto" />
                <h3 className="text-lg font-bold text-slate-800">
                  Không tìm thấy phòng phù hợp với 100% tiêu chí này
                </h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Bạn có thể thử mở rộng khoảng cách hoặc tăng nhẹ ngân sách để AI hiển thị các lựa chọn tốt nhất lân cận.
                </p>
                <button
                  onClick={handleReset}
                  className="px-5 py-2.5 bg-purple-600 text-white font-bold text-xs rounded-xl shadow-md transition"
                >
                  Làm mới tiêu chí tìm kiếm
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: INTERACTIVE LEAFLET MAP */}
        {activeTab === 'map' && (
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-lg space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-bold flex items-center gap-1">
                <MapPin className="w-4 h-4 text-purple-600" />
                Hiển thị vị trí thực tế trên Bản đồ Thái Nguyên
              </span>
              <span>Được tính bằng công thức Haversine</span>
            </div>
            <div className="h-[520px] rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
              <LeafletMap
                rooms={matchedRooms}
                selectedLocation={locationInfo}
                radiusKm={structuredQuery?.max_distance_km || 3}
              />
            </div>
          </div>
        )}

        {/* TAB 3: TRANSPARENT STRUCTURED JSON & WEIGHTS BREAKDOWN */}
        {activeTab === 'json' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* JSON Schema */}
            <div className="bg-slate-900 text-emerald-400 p-6 rounded-3xl font-mono text-xs overflow-x-auto shadow-xl space-y-3">
              <div className="flex items-center justify-between text-slate-400 text-xs border-b border-slate-800 pb-2">
                <span>Structured Query Payload (JSON)</span>
                <span className="text-[10px] text-purple-400">NLP / LLM Output</span>
              </div>
              <pre className="leading-relaxed">
                {JSON.stringify(structuredQuery || {}, null, 2)}
              </pre>
            </div>

            {/* Smart Matching Algorithm Explanation */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md space-y-4 text-xs text-slate-700">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Thuật toán Smart Matching (0 - 100%)
              </h3>
              <p className="leading-relaxed text-slate-600">
                Hệ thống backend tính điểm phù hợp độc lập dựa trên trọng số chuẩn hóa của đồ án, không để AI tự bịa đặt điểm số:
              </p>

              <div className="space-y-2.5">
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-purple-900">1. Khoảng cách GPS Haversine</span>
                    <p className="text-[11px] text-purple-700">
                      Tính bán kính từ tọa độ phòng đến trường học
                    </p>
                  </div>
                  <span className="font-extrabold text-purple-700 text-sm">Trọng số 30%</span>
                </div>

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-emerald-900">2. Giá thuê & Ngân sách</span>
                    <p className="text-[11px] text-emerald-700">
                      So sánh với mức trần tối đa người dùng đặt ra
                    </p>
                  </div>
                  <span className="font-extrabold text-emerald-700 text-sm">Trọng số 25%</span>
                </div>

                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-blue-900">3. Tiện nghi bắt buộc</span>
                    <p className="text-[11px] text-blue-700">
                      Tỷ lệ tiện ích có sẵn (Điều hòa, Wifi, Chỗ để xe, Nóng lạnh...)
                    </p>
                  </div>
                  <span className="font-extrabold text-blue-700 text-sm">Trọng số 20%</span>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-amber-900">4. Diện tích & Loại phòng</span>
                    <p className="text-[11px] text-amber-700">
                      Đạt diện tích tối thiểu và đúng loại hình (khép kín, mini, ktx)
                    </p>
                  </div>
                  <span className="font-extrabold text-amber-700 text-sm">Trọng số 20%</span>
                </div>

                <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800">5. Yêu cầu khác & Độ tin cậy</span>
                    <p className="text-[11px] text-slate-600">
                      Giờ giấc tự do, nuôi thú cưng, đánh giá chủ trọ
                    </p>
                  </div>
                  <span className="font-extrabold text-slate-700 text-sm">Trọng số 5%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
