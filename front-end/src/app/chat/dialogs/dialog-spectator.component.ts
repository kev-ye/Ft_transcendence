import { HttpClient } from "@angular/common/http";
import { Component, OnInit, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef, MatDialog } from "@angular/material/dialog";
import { DialogMute } from "./dialog-mute.component";
import { DialogUser } from "./dialog-user.component";

@Component({
    selector: "dialog-spec",
    templateUrl: "./html/dialog-spectator.html"
  })
  export class DialogSpectator implements OnInit{
    constructor(private http: HttpClient, @Inject(MAT_DIALOG_DATA) public data: any, public dialogRef: MatDialogRef<DialogSpectator>, public dialog: MatDialog) {
      console.log("data spectator", data);
      http.get('http://localhost:3000/moderator/' + data.chat.id).subscribe(data => {
        this.moderators = data as any[];
        console.log("moderators", this.moderators);
        
      })
    }
    public moderators: any[] = [];
    public users: any[] = [];
  
    fetchUsers() {
      this.http.get("http://localhost:3000/active-users/" + this.data.chat.id, {withCredentials: true}).subscribe(val => {
          console.log("fetched active users ", val);
          
          this.users = val as any[];
          let result: any[] = [];
          for (let tmp of this.users)
          {
            if (result.find(val => {
              return val.user_id == tmp.user_id;
            }))
              continue;
            result.push(tmp);
          }
          this.users = result;
      })
    }

    isModerator(usr: any) {
      if (this.moderators.find(val => val.user_id == usr.id))
        return true;
      return false;
    }

    modUser(usr: any) {
      console.log("modding", usr);
      
      this.http.post('http://localhost:3000/channels/moderator', {
        chat_id: this.data.chat.id,
        user_id: usr.id
      }, {withCredentials: true}).subscribe({next: res => {
        this.moderators.push(res);
      }});
    }

    unmodUser(usr: any) {
      this.http.patch('http://localhost:3000/channels/moderator', {
        chat_id: this.data.chat.id,
        user_id: usr.id
      }, {withCredentials: true}).subscribe({next: res => {
        const index = this.moderators.findIndex(val => val.user_id == usr.user_id);
        if (index >= 0)
          this.moderators.splice(index);
      }});
    }
  
    ngOnInit(): void {
      this.fetchUsers();
    }

    muteUser(usr: any) {
      const tmp = this.dialog.open(DialogMute, {
        data: {
          user_id: usr.id,
          chat_id: this.data.chat.id
        }
      });
    }
  
    banUser(usr: any) {
      console.log("banning ", {user_id: usr.id, chat_id: this.data.chat.id});
      
      this.http.post(`http://localhost:3000/channels/ban`,
      {
        user_id: usr.id, 
        chat_id: this.data.chat.id 
      }, {withCredentials: true})
      .subscribe({next: () => {
        this.fetchUsers();
      }}) //todo
    }
  
    openUserProfile(user: any) {
      //this.dialogRef.close();
      
      const ref = this.dialog.open(DialogUser, {
        data: {
          username: user.name,
          id: user.id,
          my_id: this.data.my_id,
          friends: this.data.friends,
          blocked: this.data.blocked
        }
      });
      
  
    }
  }