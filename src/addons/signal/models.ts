export interface SignalMessage {
    envelope: Envelope;
    account: string;
}

export interface Envelope {
    source: string;
    sourceNumber: string | null;
    sourceUuid: string;
    sourceName: string;
    sourceDevice: number;
    timestamp: number;
    serverReceivedTimestamp: number;
    serverDeliveredTimestamp: number;
    dataMessage: DataMessage;
}

export interface DataMessage {
    timestamp: number;
    message: string;
    expiresInSeconds: number;
    viewOnce: boolean;
    attachments?: Attachment[];
    quote?: Quote;
    groupInfo?: GroupInfo;
}

export interface Attachment {
    contentType: string;
    filename: string;
    id: string;
    size: number;
    width?: number;
    height?: number;
    caption?: string | null;
    uploadTimestamp?: number | null;
}

export interface Quote {
    id: number;
    author: string;
    authorNumber: string;
    authorUuid: string;
    text: string;
    attachments: any[]; // You may also change this to Attachment[] for consistency if needed.
}

export interface GroupInfo {
    groupId: string;
    groupName: string;
    revision: number;
    type: "DELIVER" | string;
}

export interface Group {
    name: string;
    description: string;
    id: string;
    internal_id: string;
    members: string[];
    blocked: boolean;
    pending_invites: string[];
    pending_requests: string[];
    invite_link: string;
    admins: string[];
}
