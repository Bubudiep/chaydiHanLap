import { _decorator, Component, Node } from "cc";
const { ccclass, property } = _decorator;

export enum PopupType {
  None,
  PauseMenu,
  GameOver,
}

@ccclass("ModalManager")
export class ModalManager extends Component {
  @property(Node)
  private contentsNode: Node = null; // Kéo thả Node Contents vào đây
  private activePopup: Node | null = null; // Node popup đang hiển thị
  private popupMap: Map<PopupType, Node> = new Map();
  protected onLoad(): void {
    this.contentsNode.children.forEach((child) => {
      if (child.name === "PauseMenu") {
        this.popupMap.set(PopupType.PauseMenu, child);
      }
      if (child.name === "GameOver") {
        this.popupMap.set(PopupType.GameOver, child);
      }
      child.active = false;
    });
    this.node.active = false;
  }
  public showPausePopup() {
    this.showPopup(PopupType.PauseMenu);
  }
  public showGameOverPopup() {
    this.showPopup(PopupType.GameOver);
  }
  public showPopup(type: PopupType) {
    const targetPopup = this.popupMap.get(type);
    if (!targetPopup) {
      console.error(`Popup type ${PopupType[type]} not found.`);
      return;
    }
    if (this.activePopup && this.activePopup !== targetPopup) {
      this.activePopup.active = false;
    }
    this.node.active = true;
    targetPopup.active = true;
    this.activePopup = targetPopup;
  }
  public closePopup() {
    if (this.activePopup) {
      this.activePopup.active = false;
      this.activePopup = null;
    }
    this.node.active = false;
  }
}
