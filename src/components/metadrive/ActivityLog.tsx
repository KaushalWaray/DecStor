
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { AlgorandAccount, Activity } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { getActivityLogs } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoaderCircle, RefreshCw, Upload, Share2, Trash2, History } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { truncateAddress } from '@/lib/utils';

interface ActivityLogProps {
  account: AlgorandAccount;
}

const ICONS: { [key in Activity['type']]: React.ElementType } = {
    UPLOAD: Upload,
    SHARE: Share2,
    DELETE: Trash2,
};

const getActionText = (activity: Activity) => {
    switch (activity.type) {
        case 'UPLOAD':
            return <>uploaded the file <span className="font-semibold text-primary">{activity.details.filename}</span>.</>;
        case 'SHARE':
            if (activity.details.recipient === 'You') {
                return <>shared the file <span className="font-semibold text-primary">{activity.details.filename}</span> with you.</>;
            }
            return <>shared the file <span className="font-semibold text-primary">{activity.details.filename}</span> with <span className="font-code text-xs text-accent">{truncateAddress(activity.details.recipient!)}</span>.</>;
        case 'DELETE':
            const count = activity.details.itemCount || 1;
            return <>deleted {count} {count > 1 ? 'items' : 'item'}.</>;
        default:
            return 'performed an action.';
    }
}

export default function ActivityLog({ account }: ActivityLogProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchActivities = useCallback(async (isInitialLoad = false) => {
    if (!isInitialLoad) setIsLoading(true);
    try {
      const response = await getActivityLogs(account.addr);
      setActivities(response.activities || []);
      if (!isInitialLoad) {
          toast({ title: "Activity log refreshed!" });
      }
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error Fetching Activity', description: error.message || 'Could not fetch your activity log.' });
    } finally {
      setIsLoading(false);
    }
  }, [account.addr, toast]);

  useEffect(() => {
    fetchActivities(true);
  }, [fetchActivities]);

  return (
    <Card className="max-w-4xl mx-auto">
        <CardHeader className="flex flex-row items-center justify-between">
             <div className="space-y-1">
                <CardTitle className="font-headline text-2xl flex items-center gap-2">
                    <History />
                    Activity Log
                </CardTitle>
                <p className="text-muted-foreground">A log of recent events in your account.</p>
            </div>
            <Button onClick={() => fetchActivities(false)} disabled={isLoading} variant="outline">
                {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh
            </Button>
        </CardHeader>
        <CardContent>
            {isLoading && activities.length === 0 ? (
                <div className="flex justify-center items-center h-64">
                    <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : activities.length === 0 ? (
                <div className="text-center text-muted-foreground h-64 flex flex-col justify-center items-center">
                    <History className="h-12 w-12 mb-4" />
                    <h3 className="text-xl font-semibold text-foreground">No Activity Yet</h3>
                    <p>Actions you take, like uploading or sharing files, will appear here.</p>
                </div>
            ) : (
                <ul className="space-y-4">
                    {activities.map(activity => {
                        const Icon = ICONS[activity.type] || History;
                        const shareSender = activity.type === 'SHARE' && activity.details.recipient === 'You' ? shares.find(s => s.cid === activity.details.cid)?.senderAddress : activity.owner;
                        return (
                            <li key={activity._id} className="flex items-start gap-4">
                                <div className="p-2 bg-muted rounded-full">
                                    <Icon className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div className="flex-grow">
                                    <p className="text-sm">
                                        {activity.type === 'SHARE' && activity.details.recipient === 'You' ? 
                                            <span className="font-mono text-xs text-accent">{truncateAddress(shareSender!)}</span> : 
                                            "You"
                                        } {getActionText(activity)}
                                    </p>
                                    <p 
                                        className="text-xs text-muted-foreground"
                                        title={format(new Date(activity.timestamp), 'PPP p')}
                                    >
                                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                                    </p>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}
        </CardContent>
    </Card>
  );
}
