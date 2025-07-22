import './BusinessServiceProtoNav.scss'

import { useState } from 'react'

import { frameToolIcon } from '../icons'

import { useApp } from '../App'
import { isFrameLikeElement } from "@excalidraw/element";

import type {
    ExcalidrawFrameLikeElement,
} from "@excalidraw/element/types";

import { getDefaultFrameName } from "@excalidraw/element/frame";


export const BusinessServiceProtoNav = () => {
    const app = useApp();
    const elements = app.scene.getNonDeletedElements();
    console.log('elements:', elements);
    
    const frames = elements.filter((el) =>
        isFrameLikeElement(el),
    ) as ExcalidrawFrameLikeElement[];
    frames.sort((a, b) => a.y - b.y);
    console.log('frames:', frames);

    const [selectedFrame, setSelectedFrame] = useState<ExcalidrawFrameLikeElement | null>(null);
    const frameClick = (frame: ExcalidrawFrameLikeElement) => {
        console.log('frame:', frame);
        setSelectedFrame(frame);
        app.scrollToContent(frame, { animate: true })
    }
    

    return (
        <>
            <div className="business-service-proto-nav">
                <div className="business-service-proto-nav-header">
                    <h4 className='business-service-proto-design'>业务服务原型设计</h4>
                    <h2 className='business-service-proto-name'>业务服务名称</h2>
                </div>
                <div className="business-service-proto-nav-body">
                    <div className="business-service-proto-nav-body-frames">
                        {(frames || []).map((frame) => (
                            <div key={frame.id} className={`business-service-proto-nav-body-frames-item ${selectedFrame?.id === frame.id ? 'active' : ''}`} onClick={() => {
                                frameClick(frame);
                            }}>
                                <div className="title-icon">{frameToolIcon}</div>
                                <div className="title-text">{frame.name ?? getDefaultFrameName(frame)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    )
};