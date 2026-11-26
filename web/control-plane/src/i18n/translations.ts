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
  // v2.0 VIP PRO additions
  exportAuditBtn: string;
  exportAuditSaved: string;
  redTeamTitle: string;
  redTeamSubtitle: string;
  redTeamSimulateBtn: string;
  redTeamBenignBtn: string;
  redTeamClearBtn: string;
  finopsSimTitle: string;
  finopsSimSubtitle: string;
  finopsFrontierLabel: string;
  finopsCascadeLabel: string;
  finopsScaleLabel: string;
  finopsLaunchForkBtn: string;
  keyboardHint: string;
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
    graphHint: 'Click any node to inspect state & tokens · Drag to pan · Photonic edge telemetry live',
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
    nodeInspectorTitle: 'NODE STATE, TOKENS & CONTRACT INSPECTOR',
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
    exportAuditBtn: 'Export Audit',
    exportAuditSaved: 'Audit Saved',
    redTeamTitle: 'RED-TEAM GUARDRAIL TESTER',
    redTeamSubtitle: 'Adversarial risk classifier (0.00-1.00) · Live Node 04 quarantine & 04 -> 01 cyclic replan',
    redTeamSimulateBtn: 'Simulate Attack',
    redTeamBenignBtn: 'Test Clean Payload',
    redTeamClearBtn: 'Clear Graph Alert',
    finopsSimTitle: 'FINOPS COST & GROUNDEDNESS A/B SIMULATOR',
    finopsSimSubtitle: 'Main vs Time-Travel Fork · Tiered Cascade Router (-52.2%) & Monthly Fleet Projection',
    finopsFrontierLabel: 'Frontier Only',
    finopsCascadeLabel: 'Tiered Cascade Router (-52.2%)',
    finopsScaleLabel: 'MONTHLY AGENT VOLUME',
    finopsLaunchForkBtn: 'Run SCN-D Live Fork',
    keyboardHint: 'KEYS: [SPACE] PLAY/PAUSE · [N] STEP · [R] RESET',
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
    graphHint: 'Nhấp vào node để soi state & token · Kéo để di chuyển · Gói tin quang học trực tiếp',
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
    nodeInspectorTitle: 'SOI TRẠNG THÁI, TOKEN & HỢP ĐỒNG GIAO THỨC',
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
    exportAuditBtn: 'Xuất Audit',
    exportAuditSaved: 'Đã Xuất Audit',
    redTeamTitle: 'HỘP CÁT KIỂM THỬ RED-TEAM GUARDRAIL',
    redTeamSubtitle: 'Bộ phân loại rủi ro đa luật (0.00-1.00) · Cách ly Node 04 & vòng lặp 04 -> 01',
    redTeamSimulateBtn: 'Mô Phỏng Tấn Công',
    redTeamBenignBtn: 'Thử Payload Sạch',
    redTeamClearBtn: 'Tắt Cảnh Báo Đồ Thị',
    finopsSimTitle: 'MÔ PHỎNG FINOPS CHI PHÍ & ĐỘ XÁC THỰC A/B',
    finopsSimSubtitle: 'So sánh Main vs Fork · Định tuyến Phân tầng (-52.2%) & Dự báo Quy mô Tháng',
    finopsFrontierLabel: 'Chỉ Model Frontier',
    finopsCascadeLabel: 'Định Tuyến Phân Tầng (-52.2%)',
    finopsScaleLabel: 'SẢN LƯỢNG CHẠY HÀNG THÁNG',
    finopsLaunchForkBtn: 'Chạy Fork Thực Tế SCN-D',
    keyboardHint: 'PHÍM TẮT: [SPACE] CHẠY/DỪNG · [N] BƯỚC · [R] ĐẶT LẠI',
  },
};
