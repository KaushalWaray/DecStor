
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { AlgorandAccount, Activity } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { getNotifications, markNotificationsAsRead } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoaderCircle, RefreshCw, Upload, Share2, Trash2, History, Bell, BellOff, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { truncateAddress } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface ActivityLogProps {
  account: AlgorandAccount;
  isTabActive: boolean;
  onLogsViewed: () => void;
}

const ICONS: { [key in Activity['type']]: React.ElementType } = {
    UPLOAD: Upload,
    SHARE: Share2,
    DELETE: Trash2,
    SEND_ALGO: ArrowUpRight,
    RECEIVE_ALGO: ArrowDownLeft,
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
        case 'SEND_ALGO':
            return <>sent <span className="font-semibold text-primary">{activity.details.amount} ALGO</span> to <span className="font-code text-xs text-accent">{truncateAddress(activity.details.recipient!)}</span></>
        case 'RECEIVE_ALGO':
            return <>received <span className="font-semibold text-primary">{activity.details.amount} ALGO</span> from <span className="font-code text-xs text-accent">{truncateAddress(activity.details.sender!)}</span></>
        default:
            return 'performed an action.';
    }
}

const getSubjectText = (activity: Activity) => {
    if (activity.type === 'SHARE' && activity.details.recipient === 'You') {
        return <span className="font-mono text-xs text-accent">{activity.details.senderAddress ? truncateAddress(activity.details.senderAddress) : 'An unknown user'}</span>;
    }
    if(activity.type === 'RECEIVE_ALGO') {
        return "You";
    }
    return "You";
}

export default function ActivityLog({ account, isTabActive, onLogsViewed }: ActivityLogProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchActivities = useCallback(async (isInitialLoad = false) => {
    if (!isInitialLoad) setIsLoading(true);
    try {
      const response = await getNotifications(account.addr);
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

  // Mark notifications as read when tab becomes active
  useEffect(() => {
    if (isTabActive) {
      const hasUnread = activities.some(a => !a.isRead);
      if (hasUnread) {
        markNotificationsAsRead(account.addr).then(() => {
          // Visually mark as read instantly for better UX
          setActivities(acts => acts.map(a => ({...a, isRead: true})));
          onLogsViewed();
        }).catch(err => {
          console.error("Failed to mark notifications as read", err);
        });
      }
    }
  }, [isTabActive, activities, account.addr, onLogsViewed]);

  return (
    <Card className="max-w-4xl mx-auto">
        <CardHeader className="flex flex-row items-center justify-between">
             <div className="space-y-1">
                <CardTitle className="font-headline text-2xl flex items-center gap-2">
                    <History />
                    Activity Log
                </CardTitle>
                <CardDescription>A log of all recent events in your account.</CardDescription>
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
                    <BellOff className="h-12 w-12 mb-4" />
                    <h3 className="text-xl font-semibold text-foreground">No Activity Yet</h3>
                    <p>Actions like uploads and shares will appear here.</p>
                </div>
            ) : (
                <ul className="space-y-1">
                    {activities.map(activity => {
                        const Icon = ICONS[activity.type] || History;
                        return (
                            <li key={activity._id} className={cn("flex items-start gap-4 p-3 rounded-md transition-colors relative", !activity.isRead && 'bg-primary/10')}>
                                {!activity.isRead && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-md" />}
                                <div className={cn("relative p-2 bg-muted rounded-full mt-1", !activity.isRead && 'bg-primary/20')}>
                                    <Icon className="h-5 w-5 text-muted-foreground" />
                                     {!activity.isRead && <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />}
                                </div>
                                <div className="flex-grow">
                                    <p className="text-sm">
                                        {getSubjectText(activity)} {getActionText(activity)}
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
