"""
TabPFN v2 (Tiny) model architecture — reconstructed from checkpoint inspection.

Architecture:
  - Feature embedding: feature_weights + feature_biases → d_model
  - Label embedding: y_embed (MLP)
  - Type embeddings: class_embed, type_embed, col_type_embed
  - Shared transformer layers (4 blocks, each with feature_attn + datapoint_attn)
  - Regression-specific layers (2 blocks) → reg_head
  - Classification-specific layers (2 blocks) → cls_head
  - Output heads: reg_head.mlp, cls_head.mlp

Config from checkpoint:
  d_model=256, n_layers=12, n_heads=8, d_ffn=1024,
  max_features=128, max_classes=10, n_bins=1024,
  n_context_max=256, n_query_max=64
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import math


class MultiHeadAttention(nn.Module):
    def __init__(self, d_model, n_heads):
        super().__init__()
        self.n_heads = n_heads
        self.d_head = d_model // n_heads

        self.norm1 = nn.LayerNorm(d_model)
        self.q_proj = nn.Linear(d_model, d_model)
        self.k_proj = nn.Linear(d_model, d_model)
        self.v_proj = nn.Linear(d_model, d_model)
        self.o_proj = nn.Linear(d_model, d_model)

        self.norm2 = nn.LayerNorm(d_model)
        self.ffn = nn.Sequential(
            nn.Linear(d_model, d_model * 4),
            nn.GELU(),
            nn.Linear(d_model * 4, d_model)
        )

    def forward(self, x):
        # Pre-norm attention
        h = self.norm1(x)
        B, N, D = h.shape

        q = self.q_proj(h).view(B, N, self.n_heads, self.d_head).transpose(1, 2)
        k = self.k_proj(h).view(B, N, self.n_heads, self.d_head).transpose(1, 2)
        v = self.v_proj(h).view(B, N, self.n_heads, self.d_head).transpose(1, 2)

        attn = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(self.d_head)
        attn = F.softmax(attn, dim=-1)
        out = torch.matmul(attn, v)
        out = out.transpose(1, 2).contiguous().view(B, N, D)
        out = self.o_proj(out)
        x = x + out

        # Pre-norm FFN
        h = self.norm2(x)
        x = x + self.ffn(h)
        return x


class TransformerBlock(nn.Module):
    def __init__(self, d_model, n_heads):
        super().__init__()
        self.feature_attn = MultiHeadAttention(d_model, n_heads)
        self.datapoint_attn = MultiHeadAttention(d_model, n_heads)

    def forward(self, x):
        # x shape: (batch, n_datapoints, n_features, d_model)
        B, N, F_dim, D = x.shape

        # Feature attention: attend across features for each datapoint
        x_feat = x.view(B * N, F_dim, D)
        x_feat = self.feature_attn(x_feat)
        x = x_feat.view(B, N, F_dim, D)

        # Datapoint attention: attend across datapoints for each feature
        x_dp = x.permute(0, 2, 1, 3).contiguous().view(B * F_dim, N, D)
        x_dp = self.datapoint_attn(x_dp)
        x = x_dp.view(B, F_dim, N, D).permute(0, 2, 1, 3).contiguous()

        return x


class OutputHead(nn.Module):
    def __init__(self, d_model, out_dim):
        super().__init__()
        self.mlp = nn.Sequential(
            nn.Linear(d_model, d_model),
            nn.GELU(),
            nn.Dropout(0.0),
            nn.Linear(d_model, out_dim)
        )

    def forward(self, x):
        return self.mlp(x)


class TabPFNv2Tiny(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        d_model = cfg['d_model']
        n_heads = cfg['n_heads']
        max_features = cfg['max_features']
        max_classes = cfg['max_classes']
        n_bins = cfg['n_bins']

        # Feature embedding
        self.feature_weights = nn.Parameter(torch.randn(max_features, 1, d_model))
        self.feature_biases = nn.Parameter(torch.zeros(max_features, 1, d_model))

        # Query token
        self.query_token = nn.Parameter(torch.randn(1, 1, d_model))

        # Label embedding
        self.y_embed = nn.Sequential()
        self.y_embed.missing_token = nn.Parameter(torch.zeros(d_model))
        self.y_embed.mlp = nn.Sequential(
            nn.Linear(1, d_model),
            nn.GELU(),
            nn.Linear(d_model, d_model)
        )

        # Type embeddings
        self.class_embed = nn.Embedding(max_classes + 1, d_model)
        self.type_embed = nn.Embedding(4, d_model)  # context/query/feature/label types
        self.col_type_embed = nn.Embedding(4, d_model)  # numerical/categorical/etc.

        # Shared transformer layers (share_factor=2 means 4 blocks reused)
        n_shared = cfg.get('share_factor', 2) * 2
        self.shared_layers = nn.ModuleList([
            TransformerBlock(d_model, n_heads) for _ in range(n_shared)
        ])

        # Task-specific layers
        self.reg_layers = nn.ModuleList([
            TransformerBlock(d_model, n_heads) for _ in range(2)
        ])
        self.cls_layers = nn.ModuleList([
            TransformerBlock(d_model, n_heads) for _ in range(2)
        ])

        # Norms
        self.shared_norm = nn.LayerNorm(d_model)
        self.reg_norm = nn.LayerNorm(d_model)
        self.cls_norm = nn.LayerNorm(d_model)

        # Output heads
        self.reg_head = OutputHead(d_model, n_bins)
        self.cls_head = OutputHead(d_model, max_classes)

    def forward(self, x_context, y_context, x_query, task='cls'):
        """
        Simplified forward pass for inference.
        x_context: (B, n_context, n_features) - training examples
        y_context: (B, n_context) - training labels
        x_query: (B, n_query, n_features) - query examples to predict
        task: 'cls' for classification, 'reg' for regression
        """
        # This is a simplified forward — the actual TabPFN forward is complex
        # For production use, we load the model and use it through the tabpfn library
        raise NotImplementedError("Use TabPFN library for inference instead of raw forward pass")
