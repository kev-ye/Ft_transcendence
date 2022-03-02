import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, Inject, OnInit, ViewChild } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { GlobalConsts } from '../common/global';
import { Router } from '@angular/router';
import { UserApiService } from '../service/user_api/user-api.service';
import { UserAuthService } from '../service/user_auth/user-auth.service';
import { Subscription } from "rxjs";
import { DialogChangeImage } from './dialogs/dialog-change-image.component';
import { DialogChangeUsername } from './dialogs/dialog-change-username.component';


@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.css']
})
export class UserComponent implements OnInit {

	private subscription: Subscription = new Subscription();
	
	user: any;
	
	changeUsername: boolean = false;
	connected: boolean = false;
	
	twoFaActive: boolean = false;
	qrCode: string = '';
	
constructor(public dialog: MatDialog,
		private http: HttpClient,
		private router: Router,
		private userApi: UserApiService,
		private userAuth: UserAuthService) { }

  refreshUserDetails() {
    //load data from backend server

    this.http.get(`${GlobalConsts.userApi}/user/id/`, {withCredentials: true}).subscribe({
      next: data => {
        if (!data) {
          console.log("Could not fetch user details");
          return ;
        }
        console.log("fetched user details", data);
        const tmp = data as any;
        this.user = tmp;
        this.user.username = tmp.name;
        this.user.avatar = `${GlobalConsts.userApi}/image/user/` + this.user.id;

        this.connected = true;

        this.http.get(`${GlobalConsts.userApi}/ladder/` + this.user.id, {withCredentials: true}).subscribe({
          next: (data: any) => {
            this.user.ladder = data.points;
          },
          error: data => {
            console.log("Could not fetch user ladder points");

        }});
    }, error: data => {
      console.log("Could not fetch user details");

    }});
  }

  ngOnInit(): void {
    this.refreshUserDetails();
	
	this.subscription.add(this.userApi.getUser().subscribe({
        next: (v) => {
          if (v.twoFactorSecret) {
            this.twoFaActive = true;
            this.qrCode = v.twoFactorQR;
          }
        },
        error: (e) => console.error('Error: get user in main:', e),
        complete: () => console.info('Complete: get user in main')
      }))
  }

  ngOnDestroy() {
	this.subscription.unsubscribe();
  }

  openImageDialog() {
    const tmp = this.dialog.open(DialogChangeImage, {
      data: {
        user_id: this.user.id
        //data
      }
    });
    tmp.afterClosed().subscribe(data => {
      if (data)
        this.user.avatar = data;
    });
  }

  openUsername() {
    if (this.changeUsername)
      this.changeUsername = false;
    else
      this.changeUsername = true;
    const ref = this.dialog.open(DialogChangeUsername, {
      data: {
        id: this.user.id
      } //change data to send to dialog
    });
    ref.afterClosed().subscribe(data => {
      if (data == true)
        this.refreshUserDetails();
    })
  }

      //// test function prepared for parameter
	  turnOnTwoFa() {
		this.subscription.add(this.userAuth.twoFaGenerate().subscribe({
		  next: (v) => {
			console.log('info:', v);
			this.qrCode = v.qr;
			this.twoFaActive = true;
		  },
		  error: (e) => {
			console.error('Error: two-fa generate:', e);
			alert('Something wrong, try again!');
		  },
		  complete: () => console.info('Complete: two-fa generate done')
		}));
	  }
  
	  turnOffTwoFa() {
		this.subscription.add(this.userAuth.twoFaTurnOff().subscribe({
		  next: _ => {
			this.qrCode = '';
			this.twoFaActive = false;
		  },
		  error: (e) => {
			console.error('Error: two-fa: turn off:', e);
			alert('Something wrong, try again!');
		  },
		  complete: () => console.info('Complete: two-fa turn off done')
		}));
	  }
}