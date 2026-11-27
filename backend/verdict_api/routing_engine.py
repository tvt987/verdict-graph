"""Multi-Model FinOps Routing & Pareto Frontier Cascade Optimizer for Verdict Graph v5.0."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, Field


ModelTier = Literal["frontier", "reasoning", "flash", "open_weight"]
SliceRole = Literal["fast", "frontier", "human_escalation"]

CACHE_INPUT_DISCOUNT = 0.88
CACHE_TTFT_SPEEDUP = 0.52
CACHE_P95_SPEEDUP = 0.34

HUMAN_ESCALATION_QUALITY_PCT = 99.8
HUMAN_ESCALATION_JSON_PCT = 99.9
HUMAN_ESCALATION_COST_PER_1K_USD = 14.0
HUMAN_ESCALATION_TTFT_MS = 180.0
HUMAN_ESCALATION_P95_MS = 950.0


@dataclass(frozen=True)
class ArenaModelProfile:
    model_id: str
    label: str
    provider: str
    tier: ModelTier
    input_usd_per_1m: float
    output_usd_per_1m: float
    ttft_ms: float
    p95_latency_ms: float
    groundedness_pct: float
    json_schema_adherence_pct: float
    accent_hex: str


ARENA_MODEL_PROFILES: tuple[ArenaModelProfile, ...] = (
    ArenaModelProfile(
        model_id="claude-4.5-sonnet",
        label="Claude 4.5 Sonnet",
        provider="Anthropic",
        tier="frontier",
        input_usd_per_1m=3.00,
        output_usd_per_1m=15.00,
        ttft_ms=390.0,
        p95_latency_ms=1240.0,
        groundedness_pct=97.8,
        json_schema_adherence_pct=99.1,
        accent_hex="#4F46E5",
    ),
    ArenaModelProfile(
        model_id="gpt-5",
        label="GPT-5",
        provider="OpenAI",
        tier="frontier",
        input_usd_per_1m=5.00,
        output_usd_per_1m=15.00,
        ttft_ms=460.0,
        p95_latency_ms=1480.0,
        groundedness_pct=98.2,
        json_schema_adherence_pct=99.3,
        accent_hex="#7C3AED",
    ),
    ArenaModelProfile(
        model_id="gemini-2.5-pro",
        label="Gemini 2.5 Pro",
        provider="Google Vertex",
        tier="frontier",
        input_usd_per_1m=1.25,
        output_usd_per_1m=10.00,
        ttft_ms=310.0,
        p95_latency_ms=980.0,
        groundedness_pct=96.6,
        json_schema_adherence_pct=98.4,
        accent_hex="#0284C7",
    ),
    ArenaModelProfile(
        model_id="deepseek-r1",
        label="DeepSeek-R1",
        provider="DeepSeek API",
        tier="reasoning",
        input_usd_per_1m=0.55,
        output_usd_per_1m=2.19,
        ttft_ms=580.0,
        p95_latency_ms=1890.0,
        groundedness_pct=95.4,
        json_schema_adherence_pct=95.8,
        accent_hex="#D97706",
    ),
    ArenaModelProfile(
        model_id="gemini-2.5-flash",
        label="Gemini 2.5 Flash",
        provider="Google Vertex",
        tier="flash",
        input_usd_per_1m=0.15,
        output_usd_per_1m=0.60,
        ttft_ms=125.0,
        p95_latency_ms=410.0,
        groundedness_pct=91.8,
        json_schema_adherence_pct=96.9,
        accent_hex="#059669",
    ),
    ArenaModelProfile(
        model_id="llama-4-70b-self-hosted",
        label="Llama 4 70B Self-Hosted",
        provider="Self-Hosted H100 vLLM",
        tier="open_weight",
        input_usd_per_1m=0.12,
        output_usd_per_1m=0.36,
        ttft_ms=145.0,
        p95_latency_ms=480.0,
        groundedness_pct=89.6,
        json_schema_adherence_pct=94.5,
        accent_hex="#0D9488",
    ),
)

ARENA_MODEL_BY_ID: dict[str, ArenaModelProfile] = {
    m.model_id: m for m in ARENA_MODEL_PROFILES
}


class RoutingValidationError(ValueError):
    """Raised when an invalid baseline model or parameter is requested."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class ParetoOptimizeRequest(BaseModel):
    monthly_request_volume: int = Field(default=2_500_000, ge=100_000, le=20_000_000)
    quality_floor_pct: float = Field(default=94.0, ge=85.0, le=99.0)
    p95_latency_budget_ms: float = Field(default=1100.0, ge=400.0, le=3000.0)
    prompt_cache_hit_rate_pct: int = Field(default=40, ge=0, le=85)
    avg_input_tokens: int = Field(default=1800, ge=50, le=128_000)
    avg_output_tokens: int = Field(default=450, ge=10, le=32_000)
    baseline_model_id: str = Field(default="claude-4.5-sonnet")


class EvaluatedRoutingModel(BaseModel):
    model_id: str
    label: str
    provider: str
    tier: ModelTier
    input_usd_per_1m: float
    output_usd_per_1m: float
    ttft_ms: float
    effective_ttft_ms: float
    p95_latency_ms: float
    effective_p95_ms: float
    groundedness_pct: float
    json_schema_adherence_pct: float
    uncached_cost_per_1k_usd: float
    effective_cost_per_1k_usd: float
    monthly_spend_usd: float
    meets_quality_floor: bool
    meets_latency_budget: bool
    meets_sla: bool
    is_pareto_optimal: bool
    accent_hex: str


class CascadeSlice(BaseModel):
    id: str
    label: str
    role: SliceRole
    share_pct: int
    monthly_requests: int
    cost_per_1k_usd: float
    monthly_spend_usd: float
    effective_ttft_ms: float
    groundedness_pct: float
    accent_hex: str


class ParetoOptimizeResponse(BaseModel):
    sla_satisfied: bool
    sla_warnings: list[str]
    policy_summary: str
    pareto_frontier_models: list[str]
    cascade_slices: list[CascadeSlice]
    blended_cost_per_1k_usd: float
    blended_monthly_spend_usd: float
    blended_groundedness_pct: float
    blended_json_adherence_pct: float
    blended_ttft_ms: float
    blended_p95_latency_ms: float
    baseline_model_id: str
    baseline_model_label: str
    single_frontier_monthly_usd: float
    single_frontier_uncached_monthly_usd: float
    prompt_cache_monthly_savings_usd: float
    monthly_savings_usd: float
    annual_savings_usd: float
    savings_pct: float
    models: list[EvaluatedRoutingModel]


def _model_cost_per_1k(
    profile: ArenaModelProfile,
    avg_input_tokens: int,
    avg_output_tokens: int,
    cache_frac: float,
) -> tuple[float, float]:
    uncached = (
        avg_input_tokens * profile.input_usd_per_1m
        + avg_output_tokens * profile.output_usd_per_1m
    ) / 1000.0
    cached_in_factor = 1.0 - CACHE_INPUT_DISCOUNT * cache_frac
    effective = (
        avg_input_tokens * profile.input_usd_per_1m * cached_in_factor
        + avg_output_tokens * profile.output_usd_per_1m
    ) / 1000.0
    return round(uncached, 4), round(effective, 4)


def _human_share_candidates(quality_floor_pct: float) -> list[int]:
    if quality_floor_pct <= 91.0:
        base = 2
    elif quality_floor_pct <= 93.5:
        base = 3
    elif quality_floor_pct <= 96.5:
        base = 5
    elif quality_floor_pct <= 97.8:
        base = 6
    else:
        base = 8

    if quality_floor_pct > 97.5:
        return sorted({base, min(25, base + 4), min(25, base + 9), min(25, base + 14)})
    return [base]


def optimize_pareto_routing(req: ParetoOptimizeRequest) -> ParetoOptimizeResponse:
    if req.baseline_model_id not in ARENA_MODEL_BY_ID:
        raise RoutingValidationError(
            "UNKNOWN_BASELINE_MODEL",
            f"Baseline model '{req.baseline_model_id}' is not registered in the 6-model routing catalog.",
        )

    cache_frac = req.prompt_cache_hit_rate_pct / 100.0
    vol_k = req.monthly_request_volume / 1000.0

    # 1. Evaluate all 6 models under prompt caching & SLA constraints
    raw_evals: list[dict[str, object]] = []
    for profile in ARENA_MODEL_PROFILES:
        uncached_1k, effective_1k = _model_cost_per_1k(
            profile, req.avg_input_tokens, req.avg_output_tokens, cache_frac
        )
        eff_ttft = round(profile.ttft_ms * (1.0 - CACHE_TTFT_SPEEDUP * cache_frac), 1)
        eff_p95 = round(profile.p95_latency_ms * (1.0 - CACHE_P95_SPEEDUP * cache_frac), 1)
        monthly_spend = round(effective_1k * vol_k, 2)
        meets_q = profile.groundedness_pct >= req.quality_floor_pct
        meets_lat = eff_p95 <= req.p95_latency_budget_ms
        raw_evals.append(
            {
                "profile": profile,
                "uncached_1k": uncached_1k,
                "effective_1k": effective_1k,
                "eff_ttft": eff_ttft,
                "eff_p95": eff_p95,
                "monthly_spend": monthly_spend,
                "meets_q": meets_q,
                "meets_lat": meets_lat,
            }
        )

    # 2. Extract strict 2D Pareto frontier in (minimize effective_cost_per_1k, maximize groundedness_pct)
    evaluated_models: list[EvaluatedRoutingModel] = []
    for row in raw_evals:
        profile = row["profile"]
        assert isinstance(profile, ArenaModelProfile)
        cost = float(row["effective_1k"])  # type: ignore[arg-type]
        qual = profile.groundedness_pct
        dominated = any(
            (other["profile"] is not profile)
            and float(other["effective_1k"]) <= cost  # type: ignore[arg-type]
            and other["profile"].groundedness_pct >= qual  # type: ignore[union-attr]
            and (
                float(other["effective_1k"]) < cost  # type: ignore[arg-type]
                or other["profile"].groundedness_pct > qual  # type: ignore[union-attr]
            )
            for other in raw_evals
        )
        evaluated_models.append(
            EvaluatedRoutingModel(
                model_id=profile.model_id,
                label=profile.label,
                provider=profile.provider,
                tier=profile.tier,
                input_usd_per_1m=profile.input_usd_per_1m,
                output_usd_per_1m=profile.output_usd_per_1m,
                ttft_ms=profile.ttft_ms,
                effective_ttft_ms=float(row["eff_ttft"]),  # type: ignore[arg-type]
                p95_latency_ms=profile.p95_latency_ms,
                effective_p95_ms=float(row["eff_p95"]),  # type: ignore[arg-type]
                groundedness_pct=qual,
                json_schema_adherence_pct=profile.json_schema_adherence_pct,
                uncached_cost_per_1k_usd=float(row["uncached_1k"]),  # type: ignore[arg-type]
                effective_cost_per_1k_usd=cost,
                monthly_spend_usd=float(row["monthly_spend"]),  # type: ignore[arg-type]
                meets_quality_floor=bool(row["meets_q"]),
                meets_latency_budget=bool(row["meets_lat"]),
                meets_sla=bool(row["meets_q"]) and bool(row["meets_lat"]),
                is_pareto_optimal=not dominated,
                accent_hex=profile.accent_hex,
            )
        )

    pareto_sorted = sorted(
        (m for m in evaluated_models if m.is_pareto_optimal),
        key=lambda m: (m.effective_cost_per_1k_usd, -m.groundedness_pct),
    )
    pareto_frontier_models = [m.model_id for m in pareto_sorted]

    eval_by_id = {m.model_id: m for m in evaluated_models}
    baseline = eval_by_id[req.baseline_model_id]

    # 3. Deterministic Pareto-Optimal Cascading Router Policy Search
    # Evaluates (fast_model, frontier_model, fast_pct, frontier_pct, human_pct)
    human_candidates = _human_share_candidates(req.quality_floor_pct)
    best_feasible: dict[str, object] | None = None
    best_fallback: dict[str, object] | None = None

    fast_pool = [m for m in evaluated_models if m.tier in ("flash", "open_weight", "reasoning")]
    frontier_pool = [m for m in evaluated_models if m.tier in ("frontier", "reasoning")]

    for fast in fast_pool:
        for frontier in frontier_pool:
            if frontier.groundedness_pct < fast.groundedness_pct:
                continue

            for human_pct in human_candidates:
                remaining = 100 - human_pct
                for fast_pct in range(0, remaining + 1):
                    frontier_pct = remaining - fast_pct
                    if fast.model_id == frontier.model_id and fast_pct > 0:
                        continue

                    is_two_tier = fast_pct > 0 and frontier_pct > 0
                    if is_two_tier:
                        gain = min(1.8, 0.6 + (frontier_pct / 100.0) * 3.2)
                        eff_fast_q = min(frontier.groundedness_pct - 0.1, fast.groundedness_pct + gain)
                        router_cost_overhead = 0.12 * fast.effective_cost_per_1k_usd
                        router_ttft_overhead = 0.20 * fast.effective_ttft_ms
                        router_p95_overhead = 0.22 * fast.effective_p95_ms
                    else:
                        eff_fast_q = fast.groundedness_pct
                        router_cost_overhead = 0.0
                        router_ttft_overhead = 0.0
                        router_p95_overhead = 0.0

                    blended_q = (
                        fast_pct * eff_fast_q
                        + frontier_pct * frontier.groundedness_pct
                        + human_pct * HUMAN_ESCALATION_QUALITY_PCT
                    ) / 100.0

                    blended_json = (
                        fast_pct * fast.json_schema_adherence_pct
                        + frontier_pct * frontier.json_schema_adherence_pct
                        + human_pct * HUMAN_ESCALATION_JSON_PCT
                    ) / 100.0

                    blended_cost = (
                        fast_pct * fast.effective_cost_per_1k_usd
                        + frontier_pct * (frontier.effective_cost_per_1k_usd + router_cost_overhead)
                        + human_pct * HUMAN_ESCALATION_COST_PER_1K_USD
                    ) / 100.0

                    blended_uncached_cost = (
                        fast_pct * fast.uncached_cost_per_1k_usd
                        + frontier_pct
                        * (
                            frontier.uncached_cost_per_1k_usd
                            + (0.12 * fast.uncached_cost_per_1k_usd if is_two_tier else 0.0)
                        )
                        + human_pct * HUMAN_ESCALATION_COST_PER_1K_USD
                    ) / 100.0

                    blended_ttft = (
                        fast_pct * fast.effective_ttft_ms
                        + frontier_pct * (frontier.effective_ttft_ms + router_ttft_overhead)
                        + human_pct * HUMAN_ESCALATION_TTFT_MS
                    ) / 100.0

                    blended_p95 = (
                        fast_pct * fast.effective_p95_ms
                        + frontier_pct * (frontier.effective_p95_ms + router_p95_overhead)
                        + human_pct * HUMAN_ESCALATION_P95_MS
                    ) / 100.0

                    meets_q = blended_q + 1e-9 >= req.quality_floor_pct
                    meets_lat = blended_p95 <= req.p95_latency_budget_ms + 1e-9

                    candidate = {
                        "fast": fast,
                        "frontier": frontier,
                        "fast_pct": fast_pct,
                        "frontier_pct": frontier_pct,
                        "human_pct": human_pct,
                        "blended_q": blended_q,
                        "blended_json": blended_json,
                        "blended_cost": blended_cost,
                        "blended_uncached_cost": blended_uncached_cost,
                        "blended_ttft": blended_ttft,
                        "blended_p95": blended_p95,
                        "meets_q": meets_q,
                        "meets_lat": meets_lat,
                    }

                    if meets_q and meets_lat:
                        score = (blended_cost, -blended_q, blended_p95, fast.model_id, frontier.model_id)
                        if best_feasible is None or score < best_feasible["score"]:  # type: ignore[operator]
                            candidate["score"] = score
                            best_feasible = candidate
                    else:
                        q_deficit = max(0.0, req.quality_floor_pct - blended_q)
                        lat_excess = max(0.0, blended_p95 - req.p95_latency_budget_ms)
                        penalty = q_deficit * 10.0 + (lat_excess / 100.0) * 4.0 + blended_cost * 0.05
                        fb_score = (penalty, blended_cost, -blended_q, blended_p95)
                        if best_fallback is None or fb_score < best_fallback["score"]:  # type: ignore[operator]
                            candidate["score"] = fb_score
                            best_fallback = candidate

    chosen = best_feasible if best_feasible is not None else best_fallback
    assert chosen is not None

    sla_satisfied = best_feasible is not None
    sla_warnings: list[str] = []
    if not chosen["meets_q"]:
        sla_warnings.append(
            f"Achievable groundedness {float(chosen['blended_q']):.2f}% is below strict {req.quality_floor_pct:.1f}% floor under current latency budget."
        )
    if not chosen["meets_lat"]:
        sla_warnings.append(
            f"Minimum achievable P95 latency {float(chosen['blended_p95']):.1f}ms exceeds {req.p95_latency_budget_ms:.0f}ms budget."
        )

    fast_m = chosen["fast"]
    frontier_m = chosen["frontier"]
    assert isinstance(fast_m, EvaluatedRoutingModel)
    assert isinstance(frontier_m, EvaluatedRoutingModel)

    fast_pct = int(chosen["fast_pct"])  # type: ignore[arg-type]
    frontier_pct = int(chosen["frontier_pct"])  # type: ignore[arg-type]
    human_pct = int(chosen["human_pct"])  # type: ignore[arg-type]

    # Build exact integer request counts summing strictly to req.monthly_request_volume
    slices: list[CascadeSlice] = []
    fast_reqs = round(req.monthly_request_volume * (fast_pct / 100.0)) if fast_pct > 0 else 0
    human_reqs = round(req.monthly_request_volume * (human_pct / 100.0)) if human_pct > 0 else 0
    frontier_reqs = req.monthly_request_volume - fast_reqs - human_reqs if frontier_pct > 0 else 0
    if frontier_pct == 0:
        fast_reqs = req.monthly_request_volume - human_reqs

    if fast_pct > 0:
        slices.append(
            CascadeSlice(
                id=fast_m.model_id,
                label=fast_m.label,
                role="fast",
                share_pct=fast_pct,
                monthly_requests=fast_reqs,
                cost_per_1k_usd=fast_m.effective_cost_per_1k_usd,
                monthly_spend_usd=round((fast_reqs / 1000.0) * fast_m.effective_cost_per_1k_usd, 2),
                effective_ttft_ms=fast_m.effective_ttft_ms,
                groundedness_pct=fast_m.groundedness_pct,
                accent_hex=fast_m.accent_hex,
            )
        )

    if frontier_pct > 0:
        is_two_tier = fast_pct > 0
        eff_frontier_cost_1k = round(
            frontier_m.effective_cost_per_1k_usd
            + (0.12 * fast_m.effective_cost_per_1k_usd if is_two_tier else 0.0),
            4,
        )
        slices.append(
            CascadeSlice(
                id=frontier_m.model_id,
                label=frontier_m.label,
                role="frontier",
                share_pct=frontier_pct,
                monthly_requests=frontier_reqs,
                cost_per_1k_usd=eff_frontier_cost_1k,
                monthly_spend_usd=round((frontier_reqs / 1000.0) * eff_frontier_cost_1k, 2),
                effective_ttft_ms=frontier_m.effective_ttft_ms,
                groundedness_pct=frontier_m.groundedness_pct,
                accent_hex=frontier_m.accent_hex,
            )
        )

    if human_pct > 0:
        slices.append(
            CascadeSlice(
                id="human-escalation",
                label="Human Escalation",
                role="human_escalation",
                share_pct=human_pct,
                monthly_requests=human_reqs,
                cost_per_1k_usd=HUMAN_ESCALATION_COST_PER_1K_USD,
                monthly_spend_usd=round((human_reqs / 1000.0) * HUMAN_ESCALATION_COST_PER_1K_USD, 2),
                effective_ttft_ms=HUMAN_ESCALATION_TTFT_MS,
                groundedness_pct=HUMAN_ESCALATION_QUALITY_PCT,
                accent_hex="#E11D48",
            )
        )

    policy_summary = " + ".join(f"{s.share_pct}% {s.label}" for s in slices)

    blended_cost_1k = round(float(chosen["blended_cost"]), 4)  # type: ignore[arg-type]
    blended_uncached_1k = round(float(chosen["blended_uncached_cost"]), 4)  # type: ignore[arg-type]
    blended_monthly_spend = round(blended_cost_1k * vol_k, 2)
    blended_uncached_monthly_spend = round(blended_uncached_1k * vol_k, 2)
    prompt_cache_monthly_savings = round(
        max(0.0, blended_uncached_monthly_spend - blended_monthly_spend), 2
    )

    single_frontier_monthly = baseline.monthly_spend_usd
    single_frontier_uncached_monthly = round(baseline.uncached_cost_per_1k_usd * vol_k, 2)
    monthly_savings = round(max(0.0, single_frontier_monthly - blended_monthly_spend), 2)
    annual_savings = round(monthly_savings * 12.0, 2)
    savings_pct = (
        round((monthly_savings / single_frontier_monthly) * 100.0, 1)
        if single_frontier_monthly > 0
        else 0.0
    )

    return ParetoOptimizeResponse(
        sla_satisfied=sla_satisfied,
        sla_warnings=sla_warnings,
        policy_summary=policy_summary,
        pareto_frontier_models=pareto_frontier_models,
        cascade_slices=slices,
        blended_cost_per_1k_usd=blended_cost_1k,
        blended_monthly_spend_usd=blended_monthly_spend,
        blended_groundedness_pct=round(float(chosen["blended_q"]), 2),  # type: ignore[arg-type]
        blended_json_adherence_pct=round(float(chosen["blended_json"]), 2),  # type: ignore[arg-type]
        blended_ttft_ms=round(float(chosen["blended_ttft"]), 1),  # type: ignore[arg-type]
        blended_p95_latency_ms=round(float(chosen["blended_p95"]), 1),  # type: ignore[arg-type]
        baseline_model_id=baseline.model_id,
        baseline_model_label=baseline.label,
        single_frontier_monthly_usd=single_frontier_monthly,
        single_frontier_uncached_monthly_usd=single_frontier_uncached_monthly,
        prompt_cache_monthly_savings_usd=prompt_cache_monthly_savings,
        monthly_savings_usd=monthly_savings,
        annual_savings_usd=annual_savings,
        savings_pct=savings_pct,
        models=evaluated_models,
    )
