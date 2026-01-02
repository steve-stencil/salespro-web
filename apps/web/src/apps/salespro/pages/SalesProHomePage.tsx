/**
 * SalesPro home page.
 *
 * Main landing page for the SalesPro field sales application.
 */
import AssignmentIcon from '@mui/icons-material/Assignment';
import PersonIcon from '@mui/icons-material/Person';
import ReceiptIcon from '@mui/icons-material/Receipt';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { useAuth } from '../../../hooks/useAuth';

type QuickActionCardProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
  comingSoon?: boolean;
};

/**
 * Quick action card for the home page.
 */
function QuickActionCard({
  title,
  description,
  icon,
  comingSoon = true,
}: QuickActionCardProps): React.ReactElement {
  return (
    <Card
      sx={{
        height: '100%',
        opacity: comingSoon ? 0.6 : 1,
        position: 'relative',
        flex: '1 1 300px',
        minWidth: 250,
      }}
    >
      {comingSoon && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            px: 1,
            py: 0.25,
            borderRadius: 1,
            fontSize: '0.625rem',
            fontWeight: 600,
            textTransform: 'uppercase',
          }}
        >
          Coming Soon
        </Box>
      )}
      <CardContent sx={{ textAlign: 'center', py: 4 }}>
        <Box sx={{ color: 'primary.main', mb: 2 }}>{icon}</Box>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </CardContent>
    </Card>
  );
}

/**
 * SalesPro home page component.
 *
 * Displays a welcome message and quick actions for field sales reps.
 */
export function SalesProHomePage(): React.ReactElement {
  const { user } = useAuth();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Welcome to SalesPro
          {user?.nameFirst && `, ${user.nameFirst}`}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Your field sales application for managing customers, quotes, and
          measure sheets.
        </Typography>
      </Box>

      {/* Quick Actions */}
      <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
        Quick Actions
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 3,
        }}
      >
        <QuickActionCard
          title="Customers"
          description="View and manage your customer database"
          icon={<PersonIcon sx={{ fontSize: 48 }} />}
          comingSoon
        />
        <QuickActionCard
          title="Quotes"
          description="Create and manage customer quotes"
          icon={<ReceiptIcon sx={{ fontSize: 48 }} />}
          comingSoon
        />
        <QuickActionCard
          title="Measure Sheets"
          description="Record measurements in the field"
          icon={<AssignmentIcon sx={{ fontSize: 48 }} />}
          comingSoon
        />
      </Box>

      {/* Coming Soon Notice */}
      <Box
        sx={{
          mt: 6,
          p: 4,
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: 1,
          borderColor: 'divider',
          textAlign: 'center',
        }}
      >
        <Typography variant="h6" color="primary" gutterBottom>
          SalesPro is Under Development
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This application is currently being built. Check back soon for updates
          as we add new features for field sales representatives.
        </Typography>
      </Box>
    </Container>
  );
}
