-- ════════════════════════════════════════════════════════════════════════
-- DELETE HALLUCINATED AI MODELS FROM SINGULARITY CITY DATABASE
-- Generated: 2026-04-10T06:19:51.440Z
-- Total: 115 clearly fake/impossible models
-- Run this in Supabase SQL Editor (uses service role, bypasses RLS).
-- ════════════════════════════════════════════════════════════════════════

-- Known fake pattern: gemini\s*ultra\s*[2-9] (1)
--   Gemini Ultra 2  [gemini_ultra_2]
-- Hallucination marker: "next-gen" (2)
--   Gemini 2 Ultra (Next-Gen)  [gemini_2_ultra_model]
--   Yi Next-Gen  [yi-next-gen-rumored-2026]
-- Hallucination marker: "next gen" (1)
--   Gemini Ultra (Next Generation)  [google_gemini_ultra_2024]
-- Hallucination marker: "in-training" (1)
--   Gemini Ultra 2 (In-Training)  [gemini_ultra_2_in_training]
-- Hallucination marker: "rumored" (1)
--   Claude 3 Opus 2 (Rumored)  [claude_3_opus_2_rumored]
-- Known fake pattern: gemini\s*1\.5\s*ultra (1)
--   Gemini 1.5 Ultra  [gemini_1_5_ultra]
-- Version 2 exceeds max known dbrx version 1 (2)
--   DBRX MoE 2  [dbrx-moe-2]
--   DBRX 2  [dbrx-2]
-- Version 3 exceeds max known kimi version 2.5 (2)
--   Kimi K3  [kimi-k3]
--   Kimi K3 Pro  [kimi-k3-pro]
-- Version 3 exceeds max known minimax version 2.5 (2)
--   MiniMax M3  [minimax-m3]
--   MiniMax M3 Audio  [minimax-m3-audio]
-- Version 5 exceeds max known llama version 4 (2)
--   Llama 5  [llama-5]
--   Llama 5 Ultra  [llama_5_ultra]
-- Version 5 exceeds max known claude version 4.6 (3)
--   Claude 5 Opus  [claude-5-opus]
--   Claude 5 Opus Vision  [claude_5_opus_vision]
--   Claude 5 Haiku  [claude-5-haiku]
-- Version 5 exceeds max known grok version 4.2 (1)
--   Grok 5  [grok-5]
-- Known fake pattern: gemini\s*[2-9](?:\.\d+)?\s*ultra (8)
--   Gemini 4.0 Ultra  [gemini-4-ultra]
--   Gemini 5.0 Ultra  [gemini-5-ultra]
--   Gemini 3 Ultra  [gemini_3_ultra]
--   Gemini 6 Ultra  [gemini-6-ultra]
--   Gemini 3.5 Ultra  [gemini-3-5-ultra]
--   Gemini 7 Ultra  [gemini-7-ultra]
--   Gemini 8 Ultra  [gemini_8_ultra]
--   Gemini 9 Ultra  [gemini-9-ultra]
-- Known fake pattern: gpt[\s\-]*[6-9](?!\.\d) (6)
--   GPT-6  [gpt-6]
--   GPT-7  [gpt-7-rumored]
--   GPT-6 Omni  [gpt_6_omni]
--   GPT-6 Vision Pro  [gpt_6_vision_pro]
--   GPT-7 Omni  [gpt-7-omni]
--   GPT-8 Omni  [gpt-8-omni]
-- Version 6 exceeds max known llama version 4 (3)
--   Llama 6  [llama-6]
--   Llama 6 Ultra  [llama-6-ultra]
--   Llama 6.0 Vision  [llama_6_0_vision]
-- Version 6 exceeds max known grok version 4.2 (1)
--   Grok 6  [grok-6]
-- Version 4 exceeds max known kimi version 2.5 (1)
--   Kimi K4  [moonshotai/kimi-k4]
-- Version 4 exceeds max known minimax version 2.5 (1)
--   MiniMax M4  [minimax/minimax-m4]
-- Version 5 exceeds max known nemotron version 4 (1)
--   Nemotron-5 340B  [nemotron-5-340b]
-- Version 3 exceeds max known yi version 2 (2)
--   Yi 3  [yi-3]
--   Yi-Coder 3 32B Instruct  [yi-coder3-32b-instruct]
-- Version 4 exceeds max known yi version 2 (1)
--   Yi 4  [yi-4]
-- Version 5 exceeds max known kimi version 2.5 (2)
--   Kimi K5  [kimi-k5]
--   Kimi K5 Audio  [moonshotai/kimi-k5-audio]
-- Version 3 exceeds max known dbrx version 1 (1)
--   DBRX 3  [dbrx-3]
-- Version 3 exceeds max known olmo version 2 (1)
--   OLMo 3 70B  [olmo-3-70b]
-- Version 4 exceeds max known step version 3.5 (1)
--   Step-4  [stepfun-step-4]
-- Version 5 exceeds max known hermes version 4 (1)
--   Hermes 5 70B  [nous_research-hermes-5-70b]
-- Version 6 exceeds max known kimi version 2.5 (2)
--   Kimi K6  [moonshotai-kimi-k6]
--   Kimi K6 Pro  [moonshotai-kimi-k6-pro]
-- Version 5 exceeds max known minimax version 2.5 (1)
--   MiniMax M5  [minimax-minimax-m5]
-- Version 4 exceeds max known olmo version 2 (2)
--   OLMo 4  [olmo-4]
--   OLMo 4 70B  [allen-ai-olmo-4-70b]
-- Version 3 exceeds max known aya version 2 (1)
--   Aya 3  [aya-3]
-- Version 5 exceeds max known yi version 2 (1)
--   Yi 5  [yi-5]
-- Version 6 exceeds max known hermes version 4 (1)
--   Hermes 6 70B  [hermes-6-70b]
-- Version 6 exceeds max known minimax version 2.5 (2)
--   MiniMax M6  [minimax-m6]
--   Minimax M6 Audio  [minimax-m6-audio]
-- Version 5 exceeds max known step version 3.5 (1)
--   Step-5  [stepfun-step5]
-- Version 7 exceeds max known kimi version 2.5 (1)
--   Kimi K7  [moonshotai-kimi-k7]
-- Version 4 exceeds max known dbrx version 1 (1)
--   DBRX 4  [databricks-dbrx4]
-- Version 5 exceeds max known olmo version 2 (1)
--   OLMo 5 70B  [olmo-5-70b]
-- Version 6 exceeds max known yi version 2 (2)
--   Yi 6  [01-ai/yi-6]
--   Yi 6 Ultra  [yi-6-ultra]
-- Version 5 exceeds max known dbrx version 1 (1)
--   DBRX 5  [databricks/dbrx-5]
-- Version 4 exceeds max known gemma version 3 (4)
--   Gemma 4 31B  [gemma-4-31b-it]
--   Gemma 4 E2B  [gemma-4-e2b-it]
--   Gemma 4 E4B  [gemma-4-e4b-it]
--   Gemma 4 26B-A4B  [gemma-4-26b-a4b-it]
-- Version 8 exceeds max known kimi version 2.5 (1)
--   Kimi K8  [moonshotai/kimi-k8]
-- Version 9 exceeds max known kimi version 2.5 (1)
--   Kimi K9  [kimi-k9]
-- Version 6 exceeds max known dbrx version 1 (1)
--   DBRX 6  [dbrx-6]
-- Future release date: 2026-05-01 (1)
--   StepFun Step 6  [stepfun-step-6]
-- Future release date: 2026-04-15 (1)
--   Doubao Pro 5  [bytedance-doubao-pro-5]
-- Version 4 exceeds max known qwen version 3.5 (1)
--   Qwen 4  [qwen4_rumored]
-- Version 5.5 exceeds max known ernie version 5 (1)
--   Ernie 5.5 Turbo  [ernie-5.5-turbo]
-- Version 7 exceeds max known yi version 2 (2)
--   Yi-7 Ultra  [yi-7-ultra]
--   Yi-7-Vision  [yi-7-vision]
-- Version 5 exceeds max known gemma version 3 (1)
--   Gemma 5 45B Instruct  [gemma_5_45b_it]
-- Version 5 exceeds max known phi version 4 (1)
--   Phi 5 Multimodal Instruct  [phi_5_multimodal_instruct]
-- Version 5.1 exceeds max known gemini version 3.1 (1)
--   Gemini 5.1 Pro  [gemini_5_1_pro]
-- Version 8 exceeds max known yi version 2 (1)
--   Yi-8  [yi-8-rumored]
-- Version 7 exceeds max known minimax version 2.5 (1)
--   Minimax M7  [minimax-m7-rumored]
-- Version 6 exceeds max known claude version 4.6 (2)
--   Claude 6 Opus  [claude-6-opus]
--   Claude 6 Ultra Vision  [claude_6_ultra_vision]
-- Version 8 exceeds max known minimax version 2.5 (1)
--   Minimax M8  [minimax_m8]
-- Version 5.5 exceeds max known gpt version 5.4 (1)
--   GPT-5.5 Pro  [gpt-5-5-pro]
-- Version 4.5 exceeds max known llama version 4 (1)
--   Llama 4.5 Instruct  [llama-4-5-instruct]
-- Version 6.5 exceeds max known gpt version 5.4 (3)
--   GPT-6.5 Turbo  [gpt-6.5-turbo]
--   GPT-6.5  [gpt_6_5]
--   GPT-6.5 Omni  [gpt_6_5_omni]
-- Version 6.5 exceeds max known claude version 4.6 (2)
--   Claude 6.5 Opus  [claude-6.5-opus]
--   Claude-6.5  [claude_6_5]
-- Version 7 exceeds max known llama version 4 (1)
--   Llama 7 Ultra  [llama-7-ultra]
-- Future release date: 2026-10-01 (1)
--   Claude 7 Opus  [claude_7_opus]
-- Future release date: 2026-07-01 (1)
--   Kimi K12  [kimi-k12-rumored]
-- Future release date: 2026-08-15 (1)
--   Yi-9 Lightning  [yi-9-lightning]
-- Future release date: 2026-09-01 (1)
--   MiniMax-m9 Omni  [minimax-m9-omni]
-- Future release date: 2026-10-10 (1)
--   Baichuan 13 Turbo  [baichuan-13-turbo]
-- Version 6.5 exceeds max known gemini version 3.1 (2)
--   Gemini 6.5 Omni  [gemini_6_5_omni]
--   Gemini 6.5  [gemini_6_5]
-- Version 6.5 exceeds max known llama version 4 (2)
--   Llama 6.5 Open  [llama_6_5_open]
--   Llama 6.5  [llama_6_5]
-- Version 7 exceeds max known gemini version 3.1 (1)
--   Gemini 7 Omni  [gemini-7-omni]
-- Version 7.5 exceeds max known claude version 4.6 (1)
--   Claude 7.5 Opus  [claude-7-5-opus]
-- Version 7.5 exceeds max known llama version 4 (1)
--   Llama 7.5 Ultra  [llama-7-5-ultra]
-- Version 6 exceeds max known gemini version 3.1 (1)
--   Gemini 6.0 Pro  [gemini_6_0_pro]
-- Version 5.5 exceeds max known claude version 4.6 (1)
--   Claude 5.5 Opus  [claude_5_5_opus]
-- Version 8 exceeds max known claude version 4.6 (1)
--   Claude 8 Opus  [claude_8_opus]
-- Version 8 exceeds max known llama version 4 (1)
--   Llama 8 Ultra  [llama_8_ultra]
-- Version 8.5 exceeds max known claude version 4.6 (1)
--   Claude 8.5 Opus  [claude-8-5-opus]
-- Version 9 exceeds max known llama version 4 (1)
--   Llama 9 Ultra  [llama-9-ultra]
-- Version 9 exceeds max known claude version 4.6 (1)
--   Claude 9 Opus  [claude-9-opus]
-- Version 10 exceeds max known llama version 4 (1)
--   Llama 10 Ultra  [llama-10-ultra]

DELETE FROM models WHERE id IN (
  'gemini_ultra_2',
  'gemini_2_ultra_model',
  'google_gemini_ultra_2024',
  'gemini_ultra_2_in_training',
  'claude_3_opus_2_rumored',
  'gemini_1_5_ultra',
  'dbrx-moe-2',
  'kimi-k3',
  'minimax-m3',
  'llama-5',
  'claude-5-opus',
  'grok-5',
  'gemini-4-ultra',
  'gpt-6',
  'llama-6',
  'grok-6',
  'gemini-5-ultra',
  'moonshotai/kimi-k4',
  'minimax/minimax-m4',
  'nemotron-5-340b',
  'yi-3',
  'kimi-k3-pro',
  'dbrx-2',
  'minimax-m3-audio',
  'yi-4',
  'kimi-k5',
  'dbrx-3',
  'olmo-3-70b',
  'stepfun-step-4',
  'nous_research-hermes-5-70b',
  'moonshotai/kimi-k5-audio',
  'moonshotai-kimi-k6',
  'minimax-minimax-m5',
  'olmo-4',
  'aya-3',
  'yi-5',
  'hermes-6-70b',
  'yi-coder3-32b-instruct',
  'minimax-m6',
  'stepfun-step5',
  'moonshotai-kimi-k7',
  'databricks-dbrx4',
  'olmo-5-70b',
  'moonshotai-kimi-k6-pro',
  '01-ai/yi-6',
  'databricks/dbrx-5',
  'gemma-4-31b-it',
  'gemma-4-e2b-it',
  'gemma-4-e4b-it',
  'gemma-4-26b-a4b-it',
  'moonshotai/kimi-k8',
  'allen-ai-olmo-4-70b',
  'kimi-k9',
  'dbrx-6',
  'stepfun-step-6',
  'bytedance-doubao-pro-5',
  'gemini_3_ultra',
  'qwen4_rumored',
  'ernie-5.5-turbo',
  'yi-7-ultra',
  'yi-7-vision',
  'minimax-m6-audio',
  'gemma_5_45b_it',
  'phi_5_multimodal_instruct',
  'gemini_5_1_pro',
  'claude_5_opus_vision',
  'llama_5_ultra',
  'gpt-7-rumored',
  'yi-8-rumored',
  'minimax-m7-rumored',
  'gemini-6-ultra',
  'claude-6-opus',
  'llama-6-ultra',
  'minimax_m8',
  'gpt-5-5-pro',
  'claude-5-haiku',
  'gemini-3-5-ultra',
  'llama-4-5-instruct',
  'gpt-6.5-turbo',
  'claude-6.5-opus',
  'gemini-7-ultra',
  'llama-7-ultra',
  'claude_7_opus',
  'kimi-k12-rumored',
  'yi-9-lightning',
  'minimax-m9-omni',
  'baichuan-13-turbo',
  'gpt_6_omni',
  'claude_6_ultra_vision',
  'gemini_6_5_omni',
  'llama_6_5_open',
  'gemini-7-omni',
  'claude-7-5-opus',
  'llama-7-5-ultra',
  'gpt_6_5',
  'claude_6_5',
  'gemini_6_5',
  'llama_6_5',
  'gemini_6_0_pro',
  'llama_6_0_vision',
  'gpt_6_vision_pro',
  'claude_5_5_opus',
  'gemini_8_ultra',
  'claude_8_opus',
  'llama_8_ultra',
  'gpt_6_5_omni',
  'gpt-7-omni',
  'claude-8-5-opus',
  'gemini-9-ultra',
  'llama-9-ultra',
  'gpt-8-omni',
  'claude-9-opus',
  'llama-10-ultra',
  'yi-6-ultra',
  'yi-next-gen-rumored-2026'
);

-- Confirm with: SELECT count(*) FROM models;
