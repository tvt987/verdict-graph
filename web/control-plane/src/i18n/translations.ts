import type { Locale } from '../types/protocol';

export interface Translations {
  brandSubtitle: string;
  scenariosHeading: string;
  controlsHeading: string;
  runtimeHeading: string;
  play: string;
  pause: string;
  step: string;
  reset: string;
  instant: string;
  speed: string;
  finopsCost: string;
  finopsTokens: string;
  finopsLatency: string;
  finopsGroundedness: string;
  graphTitle: string;
  graphHint: string;
  timeTravelTitle: string;
  branchDiffTitle: string;
  stateInspectorTitle: string;
  forkReplayBtn: string;
  applyOptimalPreset: string;
  wireTitle: string;
  hitlTitle: string;
  approveRollback: string;
  modifyCanaryApprove: string;
  rejectEscalate: string;
  canaryLabel: string;
  nodeInspectorTitle: string;
  cmdPlaceholder: string;
  browserEngine: string;
  pythonCluster: string;
  byokMode: string;
  clusterOffline: string;
  clusterOnline: string;
  verdictHeading: string;
  forkCalloutTitle: string;
  forkCalloutBody: string;
  forkCalloutBtn: string;
}

export const TRANSLATIONS: Record<Locale, Translations> = {
  en: {
    brandSubtitle: 'MULTI-AGENT CONTROL PLANE // MCP × A2A × AG-UI × OTEL',
    scenariosHeading: 'ENTERPRISE SCENARIOS',
    controlsHeading: 'EXECUTION TRANSPORT',
    runtimeHeading: 'EXECUTION RUNTIME',
    play: 'Auto-Play',
    pause: 'Pause',
    step: 'Step',
    reset: 'Reset',
    instant: 'Instant',
    speed: 'SPEED',
    finopsCost: 'RUN COST',
    finopsTokens: 'TOKENS',
    finopsLatency: 'LATENCY',
    finopsGroundedness: 'GROUNDEDNESS',
    graphTitle: 'CYCLIC MULTI-AGENT EXECUTION GRAPH',
    graphHint: 'Click any node to inspect state snapshot · Drag to pan · Scroll to zoom',
    timeTravelTitle: 'TIME-TRAVEL CHECKPOINTER & DAG',
    branchDiffTitle: 'BRANCH DIFF (A vs B)',
    stateInspectorTitle: 'CHECKPOINT STATE JSON',
    forkReplayBtn: 'Fork & Replay Branch',
    applyOptimalPreset: 'Apply Optimal Preset (top_k=8, rerank=true)',
    wireTitle: '3-PROTOCOL WIRE INSPECTOR & OTEL WATERFALL',
    hitlTitle: 'HITL INTERRUPT CHECKPOINT — OPERATOR AUTHORIZATION REQUIRED',
    approveRollback: 'Approve Rollback (100%)',
    modifyCanaryApprove: 'Modify Canary & Approve',
    rejectEscalate: 'Reject & Escalate',
    canaryLabel: 'Canary Traffic Slice',
    nodeInspectorTitle: 'NODE STATE & TELEMETRY INSPECTOR',
    cmdPlaceholder: 'Type a command, scenario, protocol tab, or action...',
    browserEngine: 'Browser Protocol Engine',
    pythonCluster: 'Python Cluster :8090',
    byokMode: 'BYOK Live LLM',
    clusterOffline: 'Offline (Browser Engine Active)',
    clusterOnline: 'Connected :8090',
    verdictHeading: 'GROUNDED SYNTHESIZER VERDICT & AG-UI WIDGET',
    forkCalloutTitle: 'LOW GROUNDEDNESS DETECTED (0.61) — TIME-TRAVEL RECOVERY READY',
    forkCalloutBody:
      'Step CP-02 retrieved 24 unranked chunks including archived 2022 drafts. Jump to CP-02, set top_k: 8, rerank: true, strict_grounding: true, and fork Branch B to recover 0.99 groundedness at 42%+ lower token cost.',
    forkCalloutBtn: 'Load CP-02 Optimal Fork Preset',
  },
  vi: {
    brandSubtitle: 'TRUNG TÂM ĐIỀU KHIỂN ĐA TÁC TỬ // MCP × A2A × AG-UI × OTEL',
    scenariosHeading: 'KỊCH BẢN DOANH NGHIỆP',
    controlsHeading: 'ĐIỀU KHIỂN THỰC THI',
    runtimeHeading: 'MÔI TRƯỜNG CHẠY',
    play: 'Tự chạy',
    pause: 'Tạm dừng',
    step: 'Từng bước',
    reset: 'Đặt lại',
    instant: 'Tức thì',
    speed: 'TỐC ĐỘ',
    finopsCost: 'CHI PHÍ',
    finopsTokens: 'TOKEN',
    finopsLatency: 'ĐỘ TRỄ',
    finopsGroundedness: 'ĐỘ XÁC THỰC',
    graphTitle: 'ĐỒ THỊ THỰC THI ĐA TÁC TỬ CÓ CHU TRÌNH',
    graphHint: 'Nhấp vào node bất kỳ để soi state · Kéo để di chuyển · Cuộn để phóng to',
    timeTravelTitle: 'CHECKPOINT DU HÀNH THỜI GIAN & DAG',
    branchDiffTitle: 'SO SÁNH NHÁNH (A vs B)',
    stateInspectorTitle: 'TRÌNH CHỈNH SỬA STATE JSON',
    forkReplayBtn: 'Tách Nhánh & Chạy Lại',
    applyOptimalPreset: 'Áp cấu hình tối ưu (top_k=8, rerank=true)',
    wireTitle: 'SOI GÓI TIN 3 GIAO THỨC & BIỂU ĐỒ OTEL GENAI',
    hitlTitle: 'ĐIỂM NGẮT HITL — YÊU CẦU PHÊ DUYỆT TỪ KỸ SƯ VẬN HÀNH',
    approveRollback: 'Duyệt Rollback (100%)',
    modifyCanaryApprove: 'Đổi Canary & Duyệt',
    rejectEscalate: 'Từ chối & Báo L3',
    canaryLabel: 'Tỷ lệ lưu lượng Canary',
    nodeInspectorTitle: 'SOI TRẠNG THÁI & THÔNG SỐ NODE',
    cmdPlaceholder: 'Nhập lệnh nhanh, kịch bản, tab giao thức hoặc thao tác...',
    browserEngine: 'Engine Giao Thức Trình Duyệt',
    pythonCluster: 'Cụm Python :8090',
    byokMode: 'BYOK LLM Trực Tiếp',
    clusterOffline: 'Chưa bật :8090 (Đang chạy Engine Trình duyệt)',
    clusterOnline: 'Đã kết nối :8090',
    verdictHeading: 'KẾT LUẬN TỔNG HỢP CÓ TRÍCH DẪN & WIDGET AG-UI',
    forkCalloutTitle: 'PHÁT HIỆN ĐỘ XÁC THỰC THẤP (0.61) — SẴN SÀNG TÁCH NHÁNH KHÔI PHỤC',
    forkCalloutBody:
      'Bước CP-02 truy xuất 24 đoạn không xếp hạng chứa tài liệu cũ 2022. Chọn CP-02, đặt top_k: 8, rerank: true, strict_grounding: true và bấm Tách Nhánh & Chạy Lại để đạt 0.99 độ xác thực và giảm >42% chi phí token.',
    forkCalloutBtn: 'Nạp cấu hình tối ưu tại CP-02',
  },
};
