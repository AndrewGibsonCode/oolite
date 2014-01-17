/*

PlayerEntityStickProfile.h

GUI for managing joystick profile settings

Oolite
Copyright (C) 2004-2013 Giles C Williams and contributors

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; either version 2
of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston,
MA 02110-1301, USA.

*/

#import "PlayerEntity.h"
#import "GuiDisplayGen.h"
#import "MyOpenGLView.h"
#import "OOJoystickProfile.h"
#import "Universe.h"

@interface PlayerEntity (StickProfile)

- (void) setGuiToStickProfileScreen: (GuiDisplayGen *) gui;
- (void) stickProfileInputHandler: (GuiDisplayGen *) gui view: (MyOpenGLView *) gameView;
- (void) stickProfileGraphAxisProfile: (GLfloat) alpha screenAt: (Vector) screenAt screenSize: (NSSize) screenSize;

@end

@interface StickProfileScreen: NSObject
{
@private
	OOJoystickManager *stickHandler;
	int current_axis;
	int current_profile_type;
	GuiDisplayGen *gui;
	int current_screen;
}

- (id) init;
- (void) startGui: (GuiDisplayGen *) gui_display_gen;
@end

