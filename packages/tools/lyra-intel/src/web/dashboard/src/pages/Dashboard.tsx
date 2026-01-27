import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  BugReport,
  Security,
  Code,
  Assessment,
} from '@mui/icons-material';

import { api } from '../services/api';
import MetricCard from '../components/MetricCard';
import IssuesList from '../components/IssuesList';
import RecentAnalyses from '../components/RecentAnalyses';

const Dashboard: React.FC = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: api.getDashboardStats,
  });

  const { data: recentAnalyses } = useQuery({
    queryKey: ['recent-analyses'],
    queryFn: () => api.getAnalyses({ limit: 5 }),
  });

  const { data: trendData } = useQuery({
    queryKey: ['issue-trends'],
    queryFn: api.getIssueTrends,
  });

  if (isLoading) {
    return <LinearProgress />;
  }

  const severityData = [
    { name: 'Critical', value: stats?.issues_by_severity?.critical || 0, color: '#ef4444' },
    { name: 'High', value: stats?.issues_by_severity?.high || 0, color: '#f97316' },
    { name: 'Medium', value: stats?.issues_by_severity?.medium || 0, color: '#eab308' },
    { name: 'Low', value: stats?.issues_by_severity?.low || 0, color: '#22c55e' },
  ];

  const languageData = Object.entries(stats?.files_by_language || {}).map(([lang, count]) => ({
    name: lang,
    files: count,
  }));

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Dashboard
      </Typography>

      {/* Metric Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Projects"
            value={stats?.total_projects || 0}
            icon={<Code />}
            color="#6366f1"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Issues"
            value={stats?.total_issues || 0}
            icon={<BugReport />}
            color="#ef4444"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Security Vulnerabilities"
            value={stats?.security_issues || 0}
            icon={<Security />}
            color="#f97316"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Code Quality Score"
            value={`${stats?.avg_quality_score || 0}%`}
            icon={<Assessment />}
            color="#22c55e"
          />
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Issues Trend */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Issue Trends
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #374151',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="critical"
                  stroke="#ef4444"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="high"
                  stroke="#f97316"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="medium"
                  stroke="#eab308"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Issues by Severity */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Issues by Severity
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={severityData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {severityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #374151',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Files by Language */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Files by Language
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={languageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #374151',
                  }}
                />
                <Bar dataKey="files" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Recent Analyses */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Analyses
            </Typography>
            <RecentAnalyses analyses={recentAnalyses?.results || []} />
          </Paper>
        </Grid>
      </Grid>

      {/* Top Issues */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Top Issues
        </Typography>
        <IssuesList issues={stats?.top_issues || []} />
      </Paper>
    </Box>
  );
};

export default Dashboard;
